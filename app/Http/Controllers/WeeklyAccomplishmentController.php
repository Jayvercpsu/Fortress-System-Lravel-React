<?php

namespace App\Http\Controllers;

use App\Models\WeeklyAccomplishment;
use Illuminate\Http\Request;
use Inertia\Inertia;

class WeeklyAccomplishmentController extends Controller
{
    public function index(Request $request)
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);

        $search = trim((string) $request->query('search', ''));
        $allowedPerPage = [5, 10, 25, 50];
        $perPage = (int) $request->query('per_page', 10);

        if (!in_array($perPage, $allowedPerPage, true)) {
            $perPage = 10;
        }

        $query = WeeklyAccomplishment::query()
            ->with('foreman:id,fullname', 'project:id,name');

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder->where('scope_of_work', 'like', "%{$search}%")
                    ->orWhere('week_start', 'like', "%{$search}%")
                    ->orWhere('percent_completed', 'like', "%{$search}%")
                    ->orWhereHas('foreman', fn ($q) => $q->where('fullname', 'like', "%{$search}%"))
                    ->orWhereHas('project', fn ($q) => $q->where('name', 'like', "%{$search}%"));
            });
        }

        $paginator = $query
            ->latest()
            ->paginate($perPage)
            ->withQueryString();

        $accomplishments = collect($paginator->items())
            ->map(fn (WeeklyAccomplishment $row) => [
                'id' => $row->id,
                'foreman_name' => $row->foreman?->fullname ?? 'Unknown',
                'project_name' => $row->project?->name ?? 'Unassigned',
                'week_start' => $row->week_start ? (string) $row->week_start : null,
                'scope_of_work' => $row->scope_of_work,
                'percent_completed' => $row->percent_completed,
                'created_at' => optional($row->created_at)?->toDateTimeString(),
            ])
            ->values();

        $page = $request->user()->role === 'head_admin'
            ? 'HeadAdmin/WeeklyAccomplishments/Index'
            : 'Admin/WeeklyAccomplishments/Index';

        return Inertia::render($page, [
            'weeklyAccomplishments' => $accomplishments,
            'weeklyAccomplishmentTable' => $this->tableMeta($paginator, $search),
        ]);
    }

    private function tableMeta($paginator, string $search): array
    {
        return [
            'search' => $search,
            'per_page' => $paginator->perPage(),
            'current_page' => $paginator->currentPage(),
            'last_page' => max(1, $paginator->lastPage()),
            'total' => $paginator->total(),
            'from' => $paginator->firstItem(),
            'to' => $paginator->lastItem(),
        ];
    }
}
