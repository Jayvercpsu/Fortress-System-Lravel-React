<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AccomplishmentCommentTest extends TestCase
{
    use RefreshDatabase;

    public function test_head_admin_can_list_and_post_comments(): void
    {
        $headAdmin = $this->makeUser('head_admin');
        $foreman = $this->makeUser('foreman');
        $project = $this->makeProject('Comment Project', $headAdmin->id);
        $submission = $this->makeSubmission($foreman, $project);

        $this->actingAs($headAdmin)
            ->getJson("/weekly-accomplishments/submissions/{$submission->id}/comments")
            ->assertOk()
            ->assertJsonCount(0);

        $this->actingAs($headAdmin)
            ->postJson("/weekly-accomplishments/submissions/{$submission->id}/comments", [
                'body' => 'Please re-check the footing depth.',
            ])
            ->assertCreated()
            ->assertJsonPath('body', 'Please re-check the footing depth.')
            ->assertJsonPath('author.name', $headAdmin->fullname);

        $this->actingAs($headAdmin)
            ->getJson("/weekly-accomplishments/submissions/{$submission->id}/comments")
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.body', 'Please re-check the footing depth.');
    }

    public function test_comment_body_is_required(): void
    {
        $headAdmin = $this->makeUser('head_admin');
        $foreman = $this->makeUser('foreman');
        $project = $this->makeProject('Comment Project', $headAdmin->id);
        $submission = $this->makeSubmission($foreman, $project);

        $this->actingAs($headAdmin)
            ->postJson("/weekly-accomplishments/submissions/{$submission->id}/comments", ['body' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('body');
    }

    public function test_foreman_cannot_comment(): void
    {
        $headAdmin = $this->makeUser('head_admin');
        $foreman = $this->makeUser('foreman');
        $project = $this->makeProject('Comment Project', $headAdmin->id);
        $submission = $this->makeSubmission($foreman, $project);

        $this->actingAs($foreman)
            ->getJson("/weekly-accomplishments/submissions/{$submission->id}/comments")
            ->assertForbidden();

        $this->actingAs($foreman)
            ->postJson("/weekly-accomplishments/submissions/{$submission->id}/comments", ['body' => 'Hi'])
            ->assertForbidden();
    }

    public function test_head_admin_cannot_comment_on_another_admins_project(): void
    {
        $owner = $this->makeUser('head_admin');
        $viewer = $this->makeUser('head_admin');
        $foreman = $this->makeUser('foreman');
        $project = $this->makeProject('Owner Secret Project', $owner->id);
        $submission = $this->makeSubmission($foreman, $project);

        $this->actingAs($viewer)
            ->getJson("/weekly-accomplishments/submissions/{$submission->id}/comments")
            ->assertForbidden();

        $this->actingAs($viewer)
            ->postJson("/weekly-accomplishments/submissions/{$submission->id}/comments", ['body' => 'Hi'])
            ->assertForbidden();
    }

    public function test_comments_paginate_newest_first_with_before_id_cursor(): void
    {
        $headAdmin = $this->makeUser('head_admin');
        $foreman = $this->makeUser('foreman');
        $project = $this->makeProject('Comment Project', $headAdmin->id);
        $submission = $this->makeSubmission($foreman, $project);

        for ($i = 1; $i <= 12; $i++) {
            $submission->comments()->create([
                'user_id' => $headAdmin->id,
                'body' => "Comment {$i}",
            ]);
        }

        $page = $this->actingAs($headAdmin)
            ->getJson("/weekly-accomplishments/submissions/{$submission->id}/comments")
            ->assertOk()
            ->assertJsonCount(10)
            ->assertJsonPath('0.body', 'Comment 3')
            ->assertJsonPath('9.body', 'Comment 12');

        $oldestId = $page->json('0.id');

        $this->actingAs($headAdmin)
            ->getJson("/weekly-accomplishments/submissions/{$submission->id}/comments?before_id={$oldestId}&limit=5")
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonPath('0.body', 'Comment 1')
            ->assertJsonPath('1.body', 'Comment 2');
    }

    public function test_author_can_edit_own_comment(): void
    {
        $headAdmin = $this->makeUser('head_admin');
        $foreman = $this->makeUser('foreman');
        $project = $this->makeProject('Comment Project', $headAdmin->id);
        $submission = $this->makeSubmission($foreman, $project);

        $comment = $submission->comments()->create([
            'user_id' => $headAdmin->id,
            'body' => 'Original text.',
        ]);

        $this->actingAs($headAdmin)
            ->putJson("/weekly-accomplishments/submissions/{$submission->id}/comments/{$comment->id}", [
                'body' => 'Edited text.',
            ])
            ->assertOk()
            ->assertJsonPath('body', 'Edited text.');

        $this->assertSame('Edited text.', $comment->fresh()->body);
    }

    public function test_cannot_edit_others_comments(): void
    {
        $owner = $this->makeUser('head_admin');
        $otherAdmin = $this->makeUser('head_admin');
        $foreman = $this->makeUser('foreman');
        $project = $this->makeProject('Comment Project', $owner->id);
        $submission = $this->makeSubmission($foreman, $project);

        $comment = $submission->comments()->create([
            'user_id' => $owner->id,
            'body' => 'Original text.',
        ]);

        // Same-project visibility is required first, so give the viewer access
        // through their own project... viewer has no access here -> 403 either way.
        $this->actingAs($otherAdmin)
            ->putJson("/weekly-accomplishments/submissions/{$submission->id}/comments/{$comment->id}", [
                'body' => 'Hijacked.',
            ])
            ->assertForbidden();

        // A peer with project access still cannot edit someone else's comment.
        $peerProject = $this->makeProject('Peer Project', $otherAdmin->id);
        $peerSubmission = $this->makeSubmission($foreman, $peerProject);
        $peerComment = $peerSubmission->comments()->create([
            'user_id' => $owner->id,
            'body' => 'Peer original.',
        ]);

        $this->assertTrue($peerSubmission->project->isVisibleTo($otherAdmin));

        $this->actingAs($otherAdmin)
            ->putJson("/weekly-accomplishments/submissions/{$peerSubmission->id}/comments/{$peerComment->id}", [
                'body' => 'Hijacked.',
            ])
            ->assertForbidden();
    }

    public function test_author_can_delete_own_comment(): void
    {
        $headAdmin = $this->makeUser('head_admin');
        $foreman = $this->makeUser('foreman');
        $project = $this->makeProject('Comment Project', $headAdmin->id);
        $submission = $this->makeSubmission($foreman, $project);

        $comment = $submission->comments()->create([
            'user_id' => $headAdmin->id,
            'body' => 'Delete me.',
        ]);

        $this->actingAs($headAdmin)
            ->deleteJson("/weekly-accomplishments/submissions/{$submission->id}/comments/{$comment->id}")
            ->assertNoContent();

        $this->assertNull($comment->fresh());
    }

    public function test_master_admin_can_delete_any_comment_while_head_admin_cannot(): void
    {
        $headAdmin = $this->makeUser('head_admin');
        $masterAdmin = $this->makeUser('master_admin');
        $otherHeadAdmin = $this->makeUser('head_admin');
        $foreman = $this->makeUser('foreman');
        $project = $this->makeProject('Comment Project', $headAdmin->id);
        $submission = $this->makeSubmission($foreman, $project);

        $first = $submission->comments()->create([
            'user_id' => $headAdmin->id,
            'body' => 'First.',
        ]);
        $second = $submission->comments()->create([
            'user_id' => $headAdmin->id,
            'body' => 'Second.',
        ]);

        $this->actingAs($otherHeadAdmin)
            ->deleteJson("/weekly-accomplishments/submissions/{$submission->id}/comments/{$first->id}")
            ->assertForbidden();

        $this->actingAs($masterAdmin)
            ->deleteJson("/weekly-accomplishments/submissions/{$submission->id}/comments/{$second->id}")
            ->assertNoContent();

        $this->assertNotNull($first->fresh());
        $this->assertNull($second->fresh());
    }

    private function makeSubmission(User $foreman, Project $project): WeeklyAccomplishment
    {
        return WeeklyAccomplishment::create([
            'foreman_id' => $foreman->id,
            'submitted_by' => $foreman->id,
            'project_id' => $project->id,
            'scope_of_work' => 'Column Footing',
            'percent_completed' => 43,
            'week_start' => '2026-08-17',
        ]);
    }

    private function makeUser(string $role): User
    {
        return User::create([
            'fullname' => ucfirst(str_replace('_', ' ', $role)) . ' ' . uniqid(),
            'email' => $role . '_' . uniqid() . '@example.test',
            'password' => Hash::make('password'),
            'role' => $role,
        ]);
    }

    private function makeProject(string $name, ?int $userId = null): Project
    {
        return Project::create([
            'name' => $name,
            'client' => 'Client',
            'type' => 'Residential',
            'location' => 'Cebu City, Philippines',
            'assigned' => null,
            'target' => null,
            'status' => 'ONGOING',
            'phase' => 'Construction',
            'overall_progress' => 0,
            'user_id' => $userId,
        ]);
    }
}
