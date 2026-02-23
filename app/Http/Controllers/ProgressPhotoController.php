<?php

namespace App\Http\Controllers;

use App\Models\ProgressPhoto;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ProgressPhotoController extends Controller
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

        $query = ProgressPhoto::query()
            ->with(['foreman:id,fullname', 'project:id,name']);

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder->where('caption', 'like', "%{$search}%")
                    ->orWhereHas('foreman', fn ($q) => $q->where('fullname', 'like', "%{$search}%"))
                    ->orWhereHas('project', fn ($q) => $q->where('name', 'like', "%{$search}%"));
            });
        }

        $paginator = $query
            ->latest()
            ->paginate($perPage)
            ->withQueryString();

        $photos = collect($paginator->items())
            ->map(fn (ProgressPhoto $photo) => [
                'id' => $photo->id,
                'photo_path' => $photo->photo_path,
                'caption' => $photo->caption,
                'foreman_name' => $photo->foreman?->fullname ?? 'Unknown',
                'project_name' => $photo->project?->name ?? 'Unassigned',
                'created_at' => optional($photo->created_at)?->toDateTimeString(),
            ])
            ->values();

        $page = $request->user()->role === 'head_admin'
            ? 'HeadAdmin/ProgressPhotos/Index'
            : 'Admin/ProgressPhotos/Index';

        return Inertia::render($page, [
            'photos' => $photos,
            'photoTable' => [
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
}
