<?php

namespace App\Http\Controllers;

use App\Models\AccomplishmentComment;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use App\Services\WeeklyAccomplishmentService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AccomplishmentCommentController extends Controller
{
    public function __construct(
        private readonly WeeklyAccomplishmentService $weeklyAccomplishmentService
    ) {
    }

    public function index(Request $request, WeeklyAccomplishment $submission)
    {
        $this->authorizeSubmission($request, $submission);

        // Newest-first page (default 10), then reversed for display. Pass
        // ?before_id=<oldest seen id>&limit=5 to scroll upward into history.
        $limit = max(1, min(50, (int) $request->query('limit', 10)));
        $beforeId = (int) $request->query('before_id', 0);

        $query = $submission->comments()
            ->with('author:id,fullname,role')
            ->orderByDesc('id');

        if ($beforeId > 0) {
            $query->where('id', '<', $beforeId);
        }

        $comments = $query->take($limit)->get()->reverse()->values();

        return response()->json(
            $comments->map(fn (AccomplishmentComment $comment) => $this->present($comment))->values()
        );
    }

    public function store(Request $request, WeeklyAccomplishment $submission)
    {
        $this->authorizeSubmission($request, $submission);

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $comment = $submission->comments()->create([
            'user_id' => $request->user()->id,
            'body' => trim($validated['body']),
        ]);
        $comment->loadMissing('author:id,fullname,role');

        return response()->json($this->present($comment), 201);
    }

    public function update(Request $request, WeeklyAccomplishment $submission, AccomplishmentComment $comment)
    {
        $this->authorizeSubmission($request, $submission);
        abort_if((int) $comment->weekly_accomplishment_id !== (int) $submission->id, 404);
        // Only the author may edit their own comment.
        abort_if((int) $comment->user_id !== (int) $request->user()->id, 403);

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $comment->update(['body' => trim($validated['body'])]);
        $comment->loadMissing('author:id,fullname,role');

        return response()->json($this->present($comment));
    }

    public function destroy(Request $request, WeeklyAccomplishment $submission, AccomplishmentComment $comment)
    {
        $this->authorizeSubmission($request, $submission);
        abort_if((int) $comment->weekly_accomplishment_id !== (int) $submission->id, 404);

        $user = $request->user();
        // Authors may delete their own comments; the master admin may delete any.
        abort_unless(
            (int) $comment->user_id === (int) $user->id || $user->role === User::ROLE_MASTER_ADMIN,
            403
        );

        $comment->delete();

        return response()->json(null, 204);
    }

    private function authorizeSubmission(Request $request, WeeklyAccomplishment $submission): void
    {
        $this->weeklyAccomplishmentService->ensureAuthorized($request->user());

        $project = $submission->project;
        abort_if(! $project || ! $project->isVisibleTo($request->user()), 403);
    }

    private function present(AccomplishmentComment $comment): array
    {
        $name = trim((string) ($comment->author?->fullname ?? ''));
        if ($name === '') {
            $name = 'Unknown user';
        }
        $initials = collect(preg_split('/\s+/', $name))
            ->filter()
            ->take(2)
            ->map(fn (string $word) => strtoupper(mb_substr($word, 0, 1)))
            ->implode('');
        $created = $comment->created_at ? Carbon::parse($comment->created_at) : null;

        return [
            'id' => (int) $comment->id,
            'body' => (string) $comment->body,
            'author_id' => $comment->user_id !== null ? (int) $comment->user_id : null,
            'created_at' => $created?->toDateTimeString(),
            'created_human' => $created?->diffForHumans(),
            'author' => [
                'name' => $name,
                'initials' => $initials !== '' ? $initials : '?',
                'role' => $comment->author
                    ? ucwords(str_replace('_', ' ', (string) $comment->author->role))
                    : 'Unknown',
            ],
        ];
    }
}
