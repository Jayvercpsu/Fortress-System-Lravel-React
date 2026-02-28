<?php

use App\Models\Attendance;
use App\Models\DeliveryConfirmation;
use App\Models\IssueReport;
use App\Models\MaterialRequest;
use App\Models\ProgressPhoto;
use App\Models\WeeklyAccomplishment;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Carbon;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('fortress:backfill-project-ids {--apply : Persist project_id updates} {--window=3 : Nearby day window for inference}', function () {
    $apply = (bool) $this->option('apply');
    $windowDays = max(0, (int) $this->option('window'));

    $this->info($apply
        ? 'Running project_id backfill in APPLY mode.'
        : 'Running project_id backfill in DRY RUN mode (no records will be updated).');
    $this->line("Window: +/- {$windowDays} day(s)");

    $normalizeDate = static function ($value): ?string {
        if ($value === null) {
            return null;
        }

        try {
            return Carbon::parse($value)->toDateString();
        } catch (\Throwable $e) {
            return null;
        }
    };

    $scoresByForemanDate = [];
    $projectsByForeman = [];

    $addScore = static function (?int $foremanId, ?int $projectId, ?string $dateKey, float $score = 1.0) use (&$scoresByForemanDate, &$projectsByForeman): void {
        if (($foremanId ?? 0) <= 0 || ($projectId ?? 0) <= 0 || $dateKey === null) {
            return;
        }

        if (!isset($scoresByForemanDate[$foremanId])) {
            $scoresByForemanDate[$foremanId] = [];
        }
        if (!isset($scoresByForemanDate[$foremanId][$dateKey])) {
            $scoresByForemanDate[$foremanId][$dateKey] = [];
        }
        if (!isset($scoresByForemanDate[$foremanId][$dateKey][$projectId])) {
            $scoresByForemanDate[$foremanId][$dateKey][$projectId] = 0.0;
        }
        $scoresByForemanDate[$foremanId][$dateKey][$projectId] += $score;

        if (!isset($projectsByForeman[$foremanId])) {
            $projectsByForeman[$foremanId] = [];
        }
        $projectsByForeman[$foremanId][$projectId] = true;
    };

    Attendance::query()
        ->whereNotNull('project_id')
        ->get(['foreman_id', 'project_id', 'date'])
        ->each(function (Attendance $row) use ($addScore, $normalizeDate): void {
            $addScore((int) $row->foreman_id, (int) $row->project_id, $normalizeDate($row->date), 2.0);
        });

    WeeklyAccomplishment::query()
        ->whereNotNull('project_id')
        ->get(['foreman_id', 'project_id', 'week_start', 'created_at'])
        ->each(function (WeeklyAccomplishment $row) use ($addScore, $normalizeDate): void {
            $foremanId = (int) $row->foreman_id;
            $projectId = (int) $row->project_id;
            $addScore($foremanId, $projectId, $normalizeDate($row->created_at), 4.0);
            $addScore($foremanId, $projectId, $normalizeDate($row->week_start), 2.5);
        });

    DeliveryConfirmation::query()
        ->whereNotNull('project_id')
        ->get(['foreman_id', 'project_id', 'delivery_date', 'created_at'])
        ->each(function (DeliveryConfirmation $row) use ($addScore, $normalizeDate): void {
            $foremanId = (int) $row->foreman_id;
            $projectId = (int) $row->project_id;
            $addScore($foremanId, $projectId, $normalizeDate($row->created_at), 3.0);
            $addScore($foremanId, $projectId, $normalizeDate($row->delivery_date), 2.0);
        });

    ProgressPhoto::query()
        ->whereNotNull('project_id')
        ->get(['foreman_id', 'project_id', 'created_at'])
        ->each(function (ProgressPhoto $row) use ($addScore, $normalizeDate): void {
            $addScore((int) $row->foreman_id, (int) $row->project_id, $normalizeDate($row->created_at), 1.5);
        });

    MaterialRequest::query()
        ->whereNotNull('project_id')
        ->get(['foreman_id', 'project_id', 'created_at'])
        ->each(function (MaterialRequest $row) use ($addScore, $normalizeDate): void {
            $addScore((int) $row->foreman_id, (int) $row->project_id, $normalizeDate($row->created_at), 2.5);
        });

    IssueReport::query()
        ->whereNotNull('project_id')
        ->get(['foreman_id', 'project_id', 'created_at'])
        ->each(function (IssueReport $row) use ($addScore, $normalizeDate): void {
            $addScore((int) $row->foreman_id, (int) $row->project_id, $normalizeDate($row->created_at), 2.5);
        });

    $fallbackProjectByForeman = [];
    foreach ($projectsByForeman as $foremanId => $projectSet) {
        if (count($projectSet) === 1) {
            $fallbackProjectByForeman[(int) $foremanId] = (int) array_key_first($projectSet);
        }
    }

    $inferProject = static function (?int $foremanId, ?string $createdDate) use (
        $scoresByForemanDate,
        $fallbackProjectByForeman,
        $windowDays
    ): array {
        if (($foremanId ?? 0) <= 0) {
            return ['project_id' => null, 'reason' => 'missing_foreman'];
        }

        $scores = [];

        $mergeScores = static function (array $incoming, float $multiplier = 1.0) use (&$scores): void {
            foreach ($incoming as $projectId => $score) {
                $pid = (int) $projectId;
                if ($pid <= 0) {
                    continue;
                }
                if (!isset($scores[$pid])) {
                    $scores[$pid] = 0.0;
                }
                $scores[$pid] += ((float) $score) * $multiplier;
            }
        };

        if ($createdDate !== null && isset($scoresByForemanDate[$foremanId][$createdDate])) {
            $mergeScores($scoresByForemanDate[$foremanId][$createdDate], 1.0);
        }

        if ($createdDate !== null && $windowDays > 0) {
            for ($dayOffset = 1; $dayOffset <= $windowDays; $dayOffset++) {
                $decay = 1.0 / ($dayOffset + 1);
                $beforeDate = Carbon::parse($createdDate)->subDays($dayOffset)->toDateString();
                $afterDate = Carbon::parse($createdDate)->addDays($dayOffset)->toDateString();

                if (isset($scoresByForemanDate[$foremanId][$beforeDate])) {
                    $mergeScores($scoresByForemanDate[$foremanId][$beforeDate], $decay);
                }
                if (isset($scoresByForemanDate[$foremanId][$afterDate])) {
                    $mergeScores($scoresByForemanDate[$foremanId][$afterDate], $decay);
                }
            }
        }

        if (!empty($scores)) {
            arsort($scores);
            $projectIds = array_keys($scores);
            $scoreValues = array_values($scores);

            if (count($projectIds) === 1) {
                return ['project_id' => (int) $projectIds[0], 'reason' => 'single_candidate'];
            }

            $topScore = (float) ($scoreValues[0] ?? 0);
            $secondScore = (float) ($scoreValues[1] ?? 0);
            if ($topScore >= ($secondScore + 1.0)) {
                return ['project_id' => (int) $projectIds[0], 'reason' => 'top_scored_candidate'];
            }

            return ['project_id' => null, 'reason' => 'ambiguous_candidates'];
        }

        if (isset($fallbackProjectByForeman[$foremanId])) {
            return ['project_id' => (int) $fallbackProjectByForeman[$foremanId], 'reason' => 'single_project_foreman'];
        }

        return ['project_id' => null, 'reason' => 'no_candidate'];
    };

    $targets = [
        ['label' => 'material_requests', 'model' => MaterialRequest::class],
        ['label' => 'issue_reports', 'model' => IssueReport::class],
    ];

    $tableRows = [];
    $unresolvedExamples = [];

    foreach ($targets as $target) {
        $modelClass = $target['model'];
        $label = $target['label'];
        $rows = $modelClass::query()
            ->whereNull('project_id')
            ->orderBy('id')
            ->get(['id', 'foreman_id', 'created_at']);

        $total = $rows->count();
        $resolved = 0;
        $updated = 0;
        $unresolved = 0;

        foreach ($rows as $row) {
            $decision = $inferProject(
                (int) ($row->foreman_id ?? 0),
                $normalizeDate($row->created_at)
            );

            $resolvedProjectId = $decision['project_id'] ?? null;
            if (($resolvedProjectId ?? 0) <= 0) {
                $unresolved++;
                if (count($unresolvedExamples) < 12) {
                    $unresolvedExamples[] = [
                        'table' => $label,
                        'id' => (int) $row->id,
                        'foreman_id' => (int) ($row->foreman_id ?? 0),
                        'created_at' => $normalizeDate($row->created_at) ?? '-',
                        'reason' => (string) ($decision['reason'] ?? 'unknown'),
                    ];
                }
                continue;
            }

            $resolved++;

            if ($apply) {
                $affected = $modelClass::query()
                    ->whereKey($row->id)
                    ->whereNull('project_id')
                    ->update(['project_id' => $resolvedProjectId]);
                if ($affected > 0) {
                    $updated++;
                }
            }
        }

        $tableRows[] = [
            'table' => $label,
            'null_rows' => $total,
            'resolved' => $resolved,
            'updated' => $updated,
            'unresolved' => $unresolved,
        ];
    }

    $this->table(
        ['Table', 'Null Rows', 'Resolved', 'Updated', 'Unresolved'],
        collect($tableRows)->map(fn (array $row) => [
            $row['table'],
            $row['null_rows'],
            $row['resolved'],
            $row['updated'],
            $row['unresolved'],
        ])->all()
    );

    if (!$apply) {
        $this->comment('Dry run complete. Re-run with --apply to persist the inferred project_id values.');
    } else {
        $this->info('Backfill apply mode complete.');
    }

    if (!empty($unresolvedExamples)) {
        $this->line('');
        $this->comment('Sample unresolved rows (up to 12):');
        $this->table(
            ['Table', 'ID', 'Foreman', 'Date', 'Reason'],
            collect($unresolvedExamples)->map(fn (array $row) => [
                $row['table'],
                $row['id'],
                $row['foreman_id'],
                $row['created_at'],
                $row['reason'],
            ])->all()
        );
    }
})->purpose('Backfill NULL project_id in material_requests and issue_reports from historical foreman activity');

Artisan::command('fortress:backfill-delivery-photos {--apply : Persist photo_path updates} {--window-hours=72 : Max hour distance between delivery and progress photo}', function () {
    $apply = (bool) $this->option('apply');
    $windowHours = max(1, (int) $this->option('window-hours'));

    $this->info($apply
        ? 'Running delivery photo backfill in APPLY mode.'
        : 'Running delivery photo backfill in DRY RUN mode (no records will be updated).');
    $this->line("Matching window: {$windowHours} hour(s)");

    $deliveries = DeliveryConfirmation::query()
        ->whereNull('photo_path')
        ->orderBy('id')
        ->get(['id', 'foreman_id', 'project_id', 'delivery_date', 'created_at']);

    $candidatePhotos = ProgressPhoto::query()
        ->whereNotNull('photo_path')
        ->where(function ($query) {
            $query->where('caption', 'like', '[Delivery]%')
                ->orWhere('caption', 'like', '[delivery]%');
        })
        ->orderBy('id')
        ->get(['id', 'foreman_id', 'project_id', 'photo_path', 'created_at']);

    $candidateBuckets = [];
    foreach ($candidatePhotos as $photo) {
        $bucketKey = (int) $photo->foreman_id . ':' . (string) ($photo->project_id ?? 'null');
        if (!isset($candidateBuckets[$bucketKey])) {
            $candidateBuckets[$bucketKey] = [];
        }
        $candidateBuckets[$bucketKey][] = $photo;
    }

    $globallyUsedPhotoPaths = DeliveryConfirmation::query()
        ->whereNotNull('photo_path')
        ->pluck('photo_path')
        ->filter(fn ($path) => trim((string) $path) !== '')
        ->mapWithKeys(fn ($path) => [trim((string) $path) => true])
        ->all();

    $usedPhotoIds = [];
    $matched = 0;
    $updated = 0;
    $unmatched = 0;
    $ambiguous = 0;
    $examples = [];

    foreach ($deliveries as $delivery) {
        $foremanId = (int) ($delivery->foreman_id ?? 0);
        if ($foremanId <= 0) {
            $unmatched++;
            continue;
        }

        $projectKey = (string) ($delivery->project_id ?? 'null');
        $bucketKey = $foremanId . ':' . $projectKey;
        $candidateSet = $candidateBuckets[$bucketKey] ?? [];

        if (empty($candidateSet) && $delivery->project_id === null) {
            // Legacy rows may have null project_id; fallback to all same-foreman delivery photos.
            foreach ($candidateBuckets as $key => $photos) {
                if (str_starts_with((string) $key, $foremanId . ':')) {
                    $candidateSet = array_merge($candidateSet, $photos);
                }
            }
        }

        if (empty($candidateSet)) {
            $unmatched++;
            if (count($examples) < 12) {
                $examples[] = [
                    'delivery_id' => (int) $delivery->id,
                    'reason' => 'no_candidates',
                    'foreman_id' => $foremanId,
                    'project_id' => $delivery->project_id ?? null,
                ];
            }
            continue;
        }

        $anchor = $delivery->created_at
            ? Carbon::parse($delivery->created_at)
            : Carbon::parse($delivery->delivery_date ?? now());

        $bestPhoto = null;
        $bestDiff = null;
        $bestTieCount = 0;

        foreach ($candidateSet as $photo) {
            if (isset($usedPhotoIds[(int) $photo->id])) {
                continue;
            }
            if (isset($globallyUsedPhotoPaths[trim((string) ($photo->photo_path ?? ''))])) {
                continue;
            }

            $photoTime = $photo->created_at ? Carbon::parse($photo->created_at) : null;
            if (!$photoTime) {
                continue;
            }

            $diffSeconds = abs($photoTime->diffInSeconds($anchor, false));
            if ($diffSeconds > ($windowHours * 3600)) {
                continue;
            }

            if ($bestPhoto === null || $diffSeconds < $bestDiff) {
                $bestPhoto = $photo;
                $bestDiff = $diffSeconds;
                $bestTieCount = 1;
                continue;
            }

            if ($diffSeconds === $bestDiff) {
                $bestTieCount++;
            }
        }

        if ($bestPhoto === null) {
            $unmatched++;
            if (count($examples) < 12) {
                $examples[] = [
                    'delivery_id' => (int) $delivery->id,
                    'reason' => 'outside_window_or_used',
                    'foreman_id' => $foremanId,
                    'project_id' => $delivery->project_id ?? null,
                ];
            }
            continue;
        }

        if ($bestTieCount > 1) {
            $ambiguous++;
            if (count($examples) < 12) {
                $examples[] = [
                    'delivery_id' => (int) $delivery->id,
                    'reason' => 'ambiguous_same_distance',
                    'foreman_id' => $foremanId,
                    'project_id' => $delivery->project_id ?? null,
                ];
            }
            continue;
        }

        $matched++;
        $usedPhotoIds[(int) $bestPhoto->id] = true;

        if ($apply) {
            $affected = DeliveryConfirmation::query()
                ->whereKey($delivery->id)
                ->whereNull('photo_path')
                ->update(['photo_path' => $bestPhoto->photo_path]);

            if ($affected > 0) {
                $updated++;
                $globallyUsedPhotoPaths[trim((string) ($bestPhoto->photo_path ?? ''))] = true;
            }
        }
    }

    $this->table(
        ['Metric', 'Count'],
        [
            ['deliveries_missing_photo_path', $deliveries->count()],
            ['candidate_delivery_progress_photos', $candidatePhotos->count()],
            ['matched', $matched],
            ['updated', $updated],
            ['unmatched', $unmatched],
            ['ambiguous', $ambiguous],
        ]
    );

    if (!$apply) {
        $this->comment('Dry run complete. Re-run with --apply to persist backfilled photo_path values.');
    } else {
        $this->info('Delivery photo backfill apply mode complete.');
    }

    if (!empty($examples)) {
        $this->line('');
        $this->comment('Sample skipped rows (up to 12):');
        $this->table(
            ['Delivery ID', 'Reason', 'Foreman', 'Project'],
            collect($examples)->map(fn (array $row) => [
                $row['delivery_id'],
                $row['reason'],
                $row['foreman_id'],
                $row['project_id'] ?? '-',
            ])->all()
        );
    }
})->purpose('Backfill delivery_confirmations.photo_path from matching [Delivery] progress photos');

Artisan::command('fortress:backfill-issue-material-photos {--apply : Persist photo_path updates} {--window-hours=72 : Max hour distance between record and progress photo}', function () {
    $apply = (bool) $this->option('apply');
    $windowHours = max(1, (int) $this->option('window-hours'));

    $this->info($apply
        ? 'Running issue/material photo backfill in APPLY mode.'
        : 'Running issue/material photo backfill in DRY RUN mode (no records will be updated).');
    $this->line("Matching window: {$windowHours} hour(s)");

    $issueRows = IssueReport::query()
        ->whereNull('photo_path')
        ->orderBy('id')
        ->get(['id', 'foreman_id', 'project_id', 'created_at']);

    $materialRows = MaterialRequest::query()
        ->whereNull('photo_path')
        ->orderBy('id')
        ->get(['id', 'foreman_id', 'project_id', 'created_at']);

    $issuePhotos = ProgressPhoto::query()
        ->whereNotNull('photo_path')
        ->where(function ($query) {
            $query->where('caption', 'like', '[Issue]%')
                ->orWhere('caption', 'like', '[issue]%');
        })
        ->orderBy('id')
        ->get(['id', 'foreman_id', 'project_id', 'photo_path', 'created_at']);

    $materialPhotos = ProgressPhoto::query()
        ->whereNotNull('photo_path')
        ->where(function ($query) {
            $query->where('caption', 'like', '[Material]%')
                ->orWhere('caption', 'like', '[material]%');
        })
        ->orderBy('id')
        ->get(['id', 'foreman_id', 'project_id', 'photo_path', 'created_at']);

    $usedPhotoPaths = collect()
        ->merge(
            DeliveryConfirmation::query()
                ->whereNotNull('photo_path')
                ->pluck('photo_path')
        )
        ->merge(
            IssueReport::query()
                ->whereNotNull('photo_path')
                ->pluck('photo_path')
        )
        ->merge(
            MaterialRequest::query()
                ->whereNotNull('photo_path')
                ->pluck('photo_path')
        )
        ->filter(fn ($path) => trim((string) $path) !== '')
        ->mapWithKeys(fn ($path) => [trim((string) $path) => true])
        ->all();

    $selectBestPhoto = static function ($row, array $candidateBuckets, array $usedPhotoPaths, int $windowHours): ?ProgressPhoto {
        $foremanId = (int) ($row->foreman_id ?? 0);
        if ($foremanId <= 0) {
            return null;
        }

        $projectKey = (string) ($row->project_id ?? 'null');
        $bucketKey = $foremanId . ':' . $projectKey;
        $candidates = $candidateBuckets[$bucketKey] ?? [];

        if (empty($candidates) && $row->project_id === null) {
            foreach ($candidateBuckets as $key => $bucketRows) {
                if (str_starts_with((string) $key, $foremanId . ':')) {
                    $candidates = array_merge($candidates, $bucketRows);
                }
            }
        }

        if (empty($candidates)) {
            return null;
        }

        $anchor = $row->created_at ? Carbon::parse($row->created_at) : Carbon::now();

        $bestPhoto = null;
        $bestDiff = null;
        $tieCount = 0;

        foreach ($candidates as $photo) {
            $photoPath = trim((string) ($photo->photo_path ?? ''));
            if ($photoPath === '' || isset($usedPhotoPaths[$photoPath])) {
                continue;
            }

            $photoTime = $photo->created_at ? Carbon::parse($photo->created_at) : null;
            if (!$photoTime) {
                continue;
            }

            $diffSeconds = abs($photoTime->diffInSeconds($anchor, false));
            if ($diffSeconds > ($windowHours * 3600)) {
                continue;
            }

            if ($bestPhoto === null || $diffSeconds < $bestDiff) {
                $bestPhoto = $photo;
                $bestDiff = $diffSeconds;
                $tieCount = 1;
                continue;
            }

            if ($diffSeconds === $bestDiff) {
                $tieCount++;
            }
        }

        if ($tieCount > 1) {
            return null;
        }

        return $bestPhoto;
    };

    $buildBuckets = static function ($photos): array {
        $buckets = [];
        foreach ($photos as $photo) {
            $bucketKey = (int) $photo->foreman_id . ':' . (string) ($photo->project_id ?? 'null');
            if (!isset($buckets[$bucketKey])) {
                $buckets[$bucketKey] = [];
            }
            $buckets[$bucketKey][] = $photo;
        }

        return $buckets;
    };

    $issueBuckets = $buildBuckets($issuePhotos);
    $materialBuckets = $buildBuckets($materialPhotos);

    $scanAndApply = function ($rows, string $targetType, array $candidateBuckets, array &$usedPhotoPaths) use ($apply, $windowHours, $selectBestPhoto) {
        $matched = 0;
        $updated = 0;
        $unmatched = 0;

        foreach ($rows as $row) {
            $photo = $selectBestPhoto($row, $candidateBuckets, $usedPhotoPaths, $windowHours);
            if (!$photo) {
                $unmatched++;
                continue;
            }

            $matched++;
            $photoPath = trim((string) ($photo->photo_path ?? ''));
            $usedPhotoPaths[$photoPath] = true;

            if ($apply) {
                if ($targetType === 'issue') {
                    $affected = IssueReport::query()
                        ->whereKey($row->id)
                        ->whereNull('photo_path')
                        ->update(['photo_path' => $photoPath]);
                } else {
                    $affected = MaterialRequest::query()
                        ->whereKey($row->id)
                        ->whereNull('photo_path')
                        ->update(['photo_path' => $photoPath]);
                }

                if (($affected ?? 0) > 0) {
                    $updated++;
                }
            }
        }

        return [
            'matched' => $matched,
            'updated' => $updated,
            'unmatched' => $unmatched,
        ];
    };

    $issueStats = $scanAndApply($issueRows, 'issue', $issueBuckets, $usedPhotoPaths);
    $materialStats = $scanAndApply($materialRows, 'material', $materialBuckets, $usedPhotoPaths);

    $this->table(
        ['Target', 'Missing', 'Candidates', 'Matched', 'Updated', 'Unmatched'],
        [
            [
                'issue_reports',
                $issueRows->count(),
                $issuePhotos->count(),
                $issueStats['matched'],
                $issueStats['updated'],
                $issueStats['unmatched'],
            ],
            [
                'material_requests',
                $materialRows->count(),
                $materialPhotos->count(),
                $materialStats['matched'],
                $materialStats['updated'],
                $materialStats['unmatched'],
            ],
        ]
    );

    if (!$apply) {
        $this->comment('Dry run complete. Re-run with --apply to persist backfilled photo_path values.');
    } else {
        $this->info('Issue/material photo backfill apply mode complete.');
    }
})->purpose('Backfill issue_reports/material_requests photo_path from matching progress photos');
