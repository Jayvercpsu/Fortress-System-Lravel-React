<?php

namespace App\Http\Controllers;

use App\Models\MonitoringBoardFile;
use App\Models\MonitoringBoardItem;
use App\Models\ProjectAssignment;
use App\Models\Project;
use App\Models\User;
use App\Support\Uploads\UploadManager;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MonitoringBoardController extends Controller
{
    private const STATUS_OPTIONS = [
        'PROPOSAL',
        'IN_REVIEW',
        'APPROVED',
        'DONE',
    ];

    public function index(Request $request)
    {
        $this->ensureAuthorized($request);

        $rawItems = MonitoringBoardItem::query()
            ->with(['files' => fn ($query) => $query->latest('id')])
            ->orderBy('department')
            ->orderByDesc('created_at')
            ->get()
            ->values();

        $projectIds = $rawItems
            ->pluck('project_id')
            ->filter()
            ->unique()
            ->values();

        $existingProjectIds = $projectIds->isEmpty()
            ? []
            : Project::query()->whereIn('id', $projectIds)->pluck('id')->all();

        $existingProjectLookup = array_fill_keys($existingProjectIds, true);

        $items = $rawItems
            ->map(fn (MonitoringBoardItem $item) => [
                'id' => (int) $item->id,
                'department' => $item->department,
                'client_name' => $item->client_name,
                'project_name' => $item->project_name,
                'project_type' => $item->project_type,
                'location' => $item->location,
                'assigned_to' => $item->assigned_to,
                'status' => $item->status,
                'start_date' => optional($item->start_date)?->toDateString(),
                'timeline' => $item->timeline,
                'due_date' => optional($item->due_date)?->toDateString(),
                'date_paid' => optional($item->date_paid)?->toDateString(),
                'progress_percent' => (int) $item->progress_percent,
                'remarks' => $item->remarks,
                'project_id' => $item->project_id,
                'project_deleted' => $item->project_id ? !isset($existingProjectLookup[$item->project_id]) : false,
                'converted_at' => optional($item->converted_at)?->toDateTimeString(),
                'files' => $item->files->map(fn (MonitoringBoardFile $file) => [
                    'id' => (int) $file->id,
                    'file_path' => $file->file_path,
                    'original_name' => $file->original_name,
                    'mime_type' => $file->mime_type,
                    'uploaded_by' => $file->uploaded_by,
                    'created_at' => optional($file->created_at)?->toDateTimeString(),
                ])->values(),
                'created_at' => optional($item->created_at)?->toDateTimeString(),
                'updated_at' => optional($item->updated_at)?->toDateTimeString(),
            ])
            ->values();

        $page = $request->user()->role === 'head_admin'
            ? 'HeadAdmin/MonitoringBoard/Index'
            : 'Admin/MonitoringBoard/Index';

        return Inertia::render($page, [
            'items' => $items,
            'status_options' => self::STATUS_OPTIONS,
            'clientOptions' => $this->clientOptionsPayload(),
        ]);
    }

    public function store(Request $request)
    {
        $this->ensureAuthorized($request);

        $validated = $this->validatedItem($request);
        $validated['created_by'] = $request->user()->id;

        $item = MonitoringBoardItem::create($validated);
        $this->maybeConvertToProject($item);

        return redirect()
            ->route('monitoring-board.index')
            ->with('success', 'Monitoring board entry added successfully.');
    }

    public function update(Request $request, MonitoringBoardItem $item)
    {
        $this->ensureAuthorized($request);

        $validated = $this->validatedItem($request);
        $item->update($validated);

        $this->maybeConvertToProject($item->fresh());

        return redirect()
            ->route('monitoring-board.index')
            ->with('success', 'Monitoring board entry updated successfully.');
    }

    public function destroy(Request $request, MonitoringBoardItem $item)
    {
        $this->ensureAuthorized($request);

        $item->delete();

        return redirect()
            ->route('monitoring-board.index')
            ->with('success', 'Monitoring board entry deleted successfully.');
    }

    public function storeFile(Request $request, MonitoringBoardItem $item)
    {
        $this->ensureAuthorized($request);

        $validated = $request->validate([
            'file' => ['required', 'file', UploadManager::maxRule()],
        ]);

        $file = $validated['file'];
        $path = UploadManager::store($file, 'monitoring-board');

        $item->files()->create([
            'file_path' => $path,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getClientMimeType(),
            'uploaded_by' => $request->user()->id,
        ]);

        return redirect()
            ->route('monitoring-board.index')
            ->with('success', 'Monitoring board file uploaded successfully.');
    }

    public function destroyFile(Request $request, MonitoringBoardFile $file)
    {
        $this->ensureAuthorized($request);

        UploadManager::delete($file->file_path);

        $file->delete();

        return redirect()
            ->route('monitoring-board.index')
            ->with('success', 'Monitoring board file deleted successfully.');
    }

    private function ensureAuthorized(Request $request): void
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);
    }

    private function validatedItem(Request $request): array
    {
        $validated = $request->validate([
            'department' => ['required', 'string', 'max:120'],
            'client_name' => ['required', 'string', 'max:255'],
            'project_name' => ['required', 'string', 'max:255'],
            'project_type' => ['required', 'string', 'max:100'],
            'location' => ['required', 'string', 'max:255'],
            'assigned_to' => ['nullable', 'string', 'max:255'],
            'status' => ['required', 'string', 'max:50'],
            'start_date' => ['nullable', 'date'],
            'timeline' => ['nullable', 'string', 'max:255'],
            'due_date' => ['nullable', 'date'],
            'date_paid' => ['nullable', 'date'],
            'progress_percent' => ['required', 'integer', 'min:0', 'max:100'],
            'remarks' => ['nullable', 'string', 'max:2000'],
        ]);

        $validated['department'] = trim((string) $validated['department']);
        if ($validated['department'] === '') {
            $validated['department'] = 'General';
        }

        $validated['assigned_to'] = trim((string) ($validated['assigned_to'] ?? ''));
        if ($validated['assigned_to'] === '') {
            $validated['assigned_to'] = null;
        }

        $validated['status'] = strtoupper(trim((string) $validated['status']));
        $validated['status'] = in_array($validated['status'], self::STATUS_OPTIONS, true)
            ? $validated['status']
            : self::STATUS_OPTIONS[0];

        return $validated;
    }

    private function maybeConvertToProject(MonitoringBoardItem $item): void
    {
        if ($item->project_id || (int) $item->progress_percent < 100) {
            return;
        }

        $project = Project::create([
            'name' => $item->project_name,
            'client' => $item->client_name,
            'type' => $item->project_type,
            'location' => $item->location,
            'assigned_role' => null,
            'assigned' => $item->assigned_to ?: null,
            'target' => null,
            'status' => 'PLANNING',
            'phase' => 'Design',
            'overall_progress' => 0,
        ]);

        $item->update([
            'project_id' => $project->id,
            'converted_at' => now(),
            'status' => 'DONE',
        ]);
    }

    private function clientOptionsPayload(): array
    {
        $clients = User::query()
            ->where('role', 'client')
            ->orderBy('fullname')
            ->get(['id', 'fullname']);

        $clientIds = $clients->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values();

        $assignments = $clientIds->isEmpty()
            ? collect()
            : ProjectAssignment::query()
                ->with('project:id,name')
                ->whereIn('user_id', $clientIds->all())
                ->where('role_in_project', 'client')
                ->latest('id')
                ->get()
                ->groupBy('user_id')
                ->map(fn ($rows) => $rows->first());

        return $clients
            ->map(function (User $user) use ($assignments) {
                $assignment = $assignments->get($user->id);
                $projectName = $assignment?->project?->name;
                $label = $projectName
                    ? "{$user->fullname} ({$projectName})"
                    : "{$user->fullname} (Unassigned)";

                return [
                    'id' => (int) $user->id,
                    'label' => $label,
                    'value' => $user->fullname,
                ];
            })
            ->values()
            ->all();
    }
}
