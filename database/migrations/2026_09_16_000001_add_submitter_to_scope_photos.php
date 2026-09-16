<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('scope_photos', function (Blueprint $table) {
            $table->unsignedBigInteger('submitted_by')->nullable()->after('caption');
            $table->string('submitted_by_role', 50)->nullable()->after('submitted_by');
            $table->index('submitted_by');
        });

        // Best-effort backfill from caption tags (uploads never recorded an
        // uploader before this migration).
        DB::table('scope_photos')
            ->where('caption', 'like', '[PM Weekly]%')
            ->whereNull('submitted_by_role')
            ->update(['submitted_by_role' => 'project_manager']);

        DB::table('scope_photos')
            ->where('caption', 'like', '[Jotform Weekly]%')
            ->whereNull('submitted_by_role')
            ->update(['submitted_by_role' => 'foreman']);

        // Attribute PM-tagged photos to the assigned PM where there is one.
        $pmPhotos = DB::table('scope_photos')
            ->join('project_scopes', 'project_scopes.id', '=', 'scope_photos.project_scope_id')
            ->where('scope_photos.caption', 'like', '[PM Weekly]%')
            ->whereNull('scope_photos.submitted_by')
            ->select('scope_photos.id', 'project_scopes.project_id')
            ->get();

        foreach ($pmPhotos as $photo) {
            $pmUserId = DB::table('project_assignments')
                ->where('project_id', $photo->project_id)
                ->where('role_in_project', 'project_manager')
                ->orderByDesc('id')
                ->value('user_id');

            if ($pmUserId === null) {
                continue;
            }

            $isPm = DB::table('users')
                ->where('id', $pmUserId)
                ->where('role', 'project_manager')
                ->exists();

            if ($isPm) {
                DB::table('scope_photos')
                    ->where('id', $photo->id)
                    ->update(['submitted_by' => $pmUserId]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('scope_photos', function (Blueprint $table) {
            $table->dropIndex(['submitted_by']);
            $table->dropColumn(['submitted_by', 'submitted_by_role']);
        });
    }
};
