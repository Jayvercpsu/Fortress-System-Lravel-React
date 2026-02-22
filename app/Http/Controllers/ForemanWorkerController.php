<?php

namespace App\Http\Controllers;

use App\Models\Worker;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class ForemanWorkerController extends Controller
{
    public function index(Request $request)
    {
        $foreman = $request->user();
        abort_unless($foreman->role === 'foreman', 403);

        $allowedPerPage = [5, 10, 25, 50];
        $search = trim((string) $request->query('search', ''));
        $perPage = (int) $request->query('per_page', 10);
        if (!in_array($perPage, $allowedPerPage, true)) {
            $perPage = 10;
        }

        $query = Worker::query()->where('foreman_id', $foreman->id);

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('place_of_birth', 'like', "%{$search}%")
                    ->orWhere('sex', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('civil_status', 'like', "%{$search}%")
                    ->orWhere('address', 'like', "%{$search}%");
            });
        }

        $paginator = $query
            ->orderBy('name')
            ->paginate($perPage)
            ->withQueryString();

        $workers = collect($paginator->items())->map(fn (Worker $worker) => [
            'id' => $worker->id,
            'name' => $worker->name,
            'default_rate_per_hour' => $worker->default_rate_per_hour !== null ? (float) $worker->default_rate_per_hour : null,
            'birth_date' => optional($worker->birth_date)?->toDateString(),
            'place_of_birth' => $worker->place_of_birth,
            'sex' => $worker->sex,
            'civil_status' => $worker->civil_status,
            'phone' => $worker->phone,
            'address' => $worker->address,
            'created_at' => optional($worker->created_at)?->toDateTimeString(),
        ])->values();

        return Inertia::render('Foreman/Workers/Index', [
            'workers' => $workers,
            'workerTable' => [
                'search' => $search,
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => max(1, $paginator->lastPage()),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $foreman = $request->user();
        abort_unless($foreman->role === 'foreman', 403);

        $validated = $request->validate($this->rules($foreman->id));

        Worker::create([
            'foreman_id' => $foreman->id,
            ...$validated,
        ]);

        return redirect()
            ->route('foreman.workers.index', $this->tableQueryParams($request))
            ->with('success', 'Worker added.');
    }

    public function update(Request $request, Worker $worker)
    {
        $foreman = $request->user();
        abort_unless($foreman->role === 'foreman' && (int) $worker->foreman_id === (int) $foreman->id, 403);

        $validated = $request->validate($this->rules($foreman->id, $worker->id));

        $worker->update($validated);

        return redirect()
            ->route('foreman.workers.index', $this->tableQueryParams($request))
            ->with('success', 'Worker updated.');
    }

    public function destroy(Request $request, Worker $worker)
    {
        $foreman = $request->user();
        abort_unless($foreman->role === 'foreman' && (int) $worker->foreman_id === (int) $foreman->id, 403);

        $worker->delete();

        return redirect()
            ->route('foreman.workers.index', $this->tableQueryParams($request))
            ->with('success', 'Worker deleted.');
    }

    private function rules(int $foremanId, ?int $workerId = null): array
    {
        return [
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('workers', 'name')
                    ->where(fn ($query) => $query->where('foreman_id', $foremanId))
                    ->ignore($workerId),
            ],
            'default_rate_per_hour' => 'nullable|numeric|min:0',
            'birth_date' => 'nullable|date|before_or_equal:today',
            'place_of_birth' => 'nullable|string|max:255',
            'sex' => 'nullable|in:male,female,other',
            'civil_status' => 'nullable|string|max:100',
            'phone' => 'nullable|string|max:50',
            'address' => 'nullable|string|max:500',
        ];
    }

    private function tableQueryParams(Request $request): array
    {
        return array_filter([
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
        ], fn ($value) => $value !== null && $value !== '');
    }
}
