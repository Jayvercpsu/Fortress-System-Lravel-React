<?php

namespace App\Http\Controllers;

use App\Models\ProgressSubmitToken;
use App\Models\ProjectFile;
use App\Models\ProjectUpdate;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;

class PublicProgressController extends Controller
{
    public function show(string $token)
    {
        $submitToken = $this->resolveActiveToken($token);

        return Inertia::render('Public/ProgressSubmit', [
            'submitToken' => [
                'project_name' => $submitToken->project->name,
                'foreman_name' => $submitToken->foreman->fullname,
                'expires_at' => optional($submitToken->expires_at)?->toDateTimeString(),
            ],
        ]);
    }

    public function store(Request $request, string $token)
    {
        $submitToken = $this->resolveActiveToken($token);

        $validated = $request->validate([
            'progress_note' => ['required', 'string', 'max:2000'],
            'photo' => ['required', 'image', 'max:10240'],
            'caption' => ['nullable', 'string', 'max:255'],
        ]);

        $uploaded = $validated['photo'];
        $path = $uploaded->store('public-progress/' . $submitToken->project_id, 'public');
        $progressNote = trim((string) $validated['progress_note']);
        $caption = trim((string) ($validated['caption'] ?? ''));

        ProjectUpdate::create([
            'project_id' => $submitToken->project_id,
            'note' => $this->formattedProgressNote($submitToken->foreman->fullname, $progressNote, $caption),
            'created_by' => $submitToken->foreman_id,
        ]);

        ProjectFile::create([
            'project_id' => $submitToken->project_id,
            'file_path' => $path,
            'original_name' => $this->submittedPhotoName($uploaded->getClientOriginalExtension()),
            'uploaded_by' => $submitToken->foreman_id,
        ]);

        $submitToken->markSubmitted();

        return redirect()
            ->route('public.progress-submit.show', ['token' => $token])
            ->with('success', 'Progress submitted successfully.');
    }

    private function resolveActiveToken(string $token): ProgressSubmitToken
    {
        $submitToken = ProgressSubmitToken::query()
            ->with(['project:id,name', 'foreman:id,fullname'])
            ->where('token', $token)
            ->firstOrFail();

        abort_unless($submitToken->isActive(), 404);

        return $submitToken;
    }

    private function formattedProgressNote(string $foremanName, string $progressNote, string $caption): string
    {
        $captionLine = $caption !== '' ? "\nCaption: {$caption}" : '';

        return "[Public Progress Submit]\n"
            . "Foreman: {$foremanName}\n"
            . "Note: {$progressNote}{$captionLine}";
    }

    private function submittedPhotoName(string $extension): string
    {
        $safeExtension = $extension !== '' ? strtolower($extension) : 'jpg';
        $timestamp = now()->format('Ymd_His');
        $random = Str::lower(Str::random(6));

        return "public_progress_{$timestamp}_{$random}.{$safeExtension}";
    }
}
