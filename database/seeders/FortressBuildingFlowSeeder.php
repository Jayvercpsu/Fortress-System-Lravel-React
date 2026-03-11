<?php

namespace Database\Seeders;

use App\Models\Attendance;
use App\Models\BuildProject;
use App\Models\DeliveryConfirmation;
use App\Models\DesignProject;
use App\Models\Expense;
use App\Models\IssueReport;
use App\Models\Material;
use App\Models\MaterialRequest;
use App\Models\MonitoringBoardFile;
use App\Models\MonitoringBoardItem;
use App\Models\Payroll;
use App\Models\PayrollCutoff;
use App\Models\PayrollDeduction;
use App\Models\Payment;
use App\Models\ProgressPhoto;
use App\Models\ProgressSubmitToken;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\ProjectFile;
use App\Models\ProjectScope;
use App\Models\ProjectUpdate;
use App\Models\ProjectWorker;
use App\Models\ScopePhoto;
use App\Models\User;
use App\Models\UserDetail;
use App\Models\WeeklyAccomplishment;
use App\Models\Worker;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class FortressBuildingFlowSeeder extends Seeder
{
    private const PROJECT_NAME = 'Fortress Building';
    private const ELIGIBLE_DESIGN_PROJECT_NAME = 'Fortress Civic Center';
    private const PENDING_DESIGN_PROJECT_NAME = 'Fortress Experience Hub';
    private const COMPLETED_PROJECT_NAME = 'Fortress Warehouse Annex';
    private const ASSET_ROOT = 'demo/fortress-building';
    private const PRIMARY_FOREMAN_EMAIL = 'fortress.foreman@buildbooks.com';
    private const CO_FOREMAN_EMAIL = 'fortress.coforeman@buildbooks.com';
    private const PRIMARY_TOKEN = 'fortress-building-main-demo-token';
    private const CO_TOKEN = 'fortress-building-co-demo-token';
    private const PAYROLL_WEEK_START = '2026-03-02';
    private const PAYROLL_WEEK_END = '2026-03-08';
    private const ATTENDANCE_CODE_HOURS = [
        'P' => 8.0,
        'A' => 0.0,
        'H' => 4.0,
        'R' => 0.0,
        'F' => 0.0,
    ];

    private ?array $downloadImagesCache = null;

    public function run(): void
    {
        $this->cleanupDatabaseExceptUsersAndUserDetails();
        $this->ensureMaterialCategories();

        $primaryForeman = User::query()->updateOrCreate(
            ['email' => self::PRIMARY_FOREMAN_EMAIL],
            [
                'fullname' => 'Fortress Demo Foreman',
                'password' => 'password',
                'role' => 'foreman',
                'default_rate_per_hour' => 135.00,
            ]
        );

        $coForeman = User::query()->updateOrCreate(
            ['email' => self::CO_FOREMAN_EMAIL],
            [
                'fullname' => 'Fortress Demo Co-Foreman',
                'password' => 'password',
                'role' => 'foreman',
                'default_rate_per_hour' => 128.00,
            ]
        );

        $workerSeedRows = $this->workerSeedRows($primaryForeman, $coForeman);

        $assets = $this->prepareAssets();

        $this->seedUserDetail($primaryForeman, [
            'age' => 33,
            'birth_date' => '1992-06-18',
            'place_of_birth' => 'Cebu City',
            'sex' => 'male',
            'civil_status' => 'Married',
            'phone' => '09171234567',
            'address' => 'Basak, Mandaue City, Cebu',
            'profile_photo_path' => $assets['primary_profile'],
        ]);

        $this->seedUserDetail($coForeman, [
            'age' => 31,
            'birth_date' => '1994-01-12',
            'place_of_birth' => 'Lapu-Lapu City',
            'sex' => 'male',
            'civil_status' => 'Single',
            'phone' => '09179876543',
            'address' => 'Gun-ob, Lapu-Lapu City, Cebu',
            'profile_photo_path' => $assets['co_profile'],
        ]);

        $seedAdmin = User::query()
            ->whereIn('email', ['headadmin@buildbooks.com', 'admin@buildbooks.com'])
            ->orderByRaw("
                case
                    when email = 'headadmin@buildbooks.com' then 0
                    when email = 'admin@buildbooks.com' then 1
                    else 2
                end
            ")
            ->first()
            ?: User::query()->updateOrCreate(
                ['email' => 'fortress.seed.admin@buildbooks.com'],
                [
                    'fullname' => 'Fortress Seed Admin',
                    'password' => 'password',
                    'role' => 'head_admin',
                ]
            );

        DB::transaction(function () use ($assets, $primaryForeman, $coForeman, $seedAdmin, $workerSeedRows): void {
            $designSourceProject = $this->createProjectRecord($this->designSourceProjectAttributes($primaryForeman, $coForeman));
            $eligibleDesignProject = $this->createProjectRecord($this->eligibleDesignProjectAttributes($primaryForeman, $coForeman));
            $pendingDesignProject = $this->createProjectRecord($this->pendingDesignProjectAttributes($primaryForeman, $coForeman));
            $constructionProject = $this->createProjectRecord(array_merge(
                $this->projectAttributes($primaryForeman, $coForeman),
                ['source_project_id' => $designSourceProject->id]
            ));
            $completedProject = $this->createProjectRecord(array_merge(
                $this->completedProjectAttributes($primaryForeman, $coForeman),
                ['source_project_id' => $designSourceProject->id]
            ));

            DesignProject::query()->updateOrCreate(
                ['project_id' => $designSourceProject->id],
                $this->designProjectAttributes($designSourceProject)
            );
            DesignProject::query()->updateOrCreate(
                ['project_id' => $eligibleDesignProject->id],
                $this->eligibleDesignTrackerAttributes()
            );
            DesignProject::query()->updateOrCreate(
                ['project_id' => $pendingDesignProject->id],
                $this->pendingDesignTrackerAttributes()
            );

            BuildProject::query()->updateOrCreate(
                ['project_id' => $constructionProject->id],
                $this->buildProjectAttributes($constructionProject)
            );
            BuildProject::query()->updateOrCreate(
                ['project_id' => $completedProject->id],
                $this->completedBuildProjectAttributes($completedProject)
            );

            ProjectAssignment::query()->insert($this->projectAssignmentRows($designSourceProject, $primaryForeman, $coForeman));
            ProjectAssignment::query()->insert($this->projectAssignmentRows($eligibleDesignProject, $primaryForeman, $coForeman));
            ProjectAssignment::query()->insert($this->projectAssignmentRows($pendingDesignProject, $primaryForeman, $coForeman));
            ProjectAssignment::query()->insert($this->projectAssignmentRows($constructionProject, $primaryForeman, $coForeman));
            ProjectAssignment::query()->insert($this->projectAssignmentRows($completedProject, $primaryForeman, $coForeman));

            $scopesByName = collect($this->scopeSeedRows($primaryForeman, $coForeman))->mapWithKeys(function (array $scopeRow) use ($constructionProject) {
                $scope = ProjectScope::query()->create(array_merge($scopeRow, ['project_id' => $constructionProject->id]));
                return [$scopeRow['scope_name'] => $scope];
            });

            foreach ($this->scopePhotoRows($assets) as $row) {
                if (!$row['photo']) {
                    continue;
                }

                ScopePhoto::query()->create([
                    'project_scope_id' => $scopesByName[$row['scope']]->id,
                    'photo_path' => $row['photo'],
                    'caption' => $row['caption'],
                ]);
            }

            foreach ($workerSeedRows as $workerData) {
                Worker::query()->create(array_merge($workerData, ['project_id' => $constructionProject->id]));
            }

            ProjectWorker::query()->insert($this->projectWorkerRows($constructionProject));
            Attendance::query()->insert($this->buildAttendanceRows($constructionProject->id, $primaryForeman, $coForeman, $workerSeedRows));
            WeeklyAccomplishment::query()->insert($this->weeklyAccomplishmentRows($constructionProject, $primaryForeman, $coForeman));
            MaterialRequest::query()->insert($this->materialRequestRows($constructionProject, $primaryForeman, $coForeman, $assets));
            IssueReport::query()->insert($this->issueRows($constructionProject, $primaryForeman, $coForeman, $assets));
            DeliveryConfirmation::query()->insert($this->deliveryRows($constructionProject, $primaryForeman, $coForeman, $assets));
            ProgressPhoto::query()->insert($this->progressPhotoRows($constructionProject, $primaryForeman, $coForeman, $assets));
            ProjectUpdate::query()->insert($this->projectUpdateRows($constructionProject, $seedAdmin, $primaryForeman, $coForeman));
            ProjectUpdate::query()->insert([
                [
                    'project_id' => $designSourceProject->id,
                    'note' => 'Monitoring Board entry reached 100%, client approved the design package, and the design record is now retained as the source for the transferred construction duplicate.',
                    'created_by' => $seedAdmin->id,
                    'created_at' => '2026-01-28 17:00:00',
                    'updated_at' => '2026-01-28 17:00:00',
                ],
                [
                    'project_id' => $eligibleDesignProject->id,
                    'note' => 'Client already approved the concept package. This design card stays in the Design column so the Transfer to Construction button can be tested manually.',
                    'created_by' => $seedAdmin->id,
                    'created_at' => '2026-03-05 16:40:00',
                    'updated_at' => '2026-03-05 16:40:00',
                ],
                [
                    'project_id' => $pendingDesignProject->id,
                    'note' => 'Design team is still revising the experiential layout and MEP coordination package. Client approval remains pending, so transfer should stay unavailable.',
                    'created_by' => $seedAdmin->id,
                    'created_at' => '2026-03-09 18:15:00',
                    'updated_at' => '2026-03-09 18:15:00',
                ],
                [
                    'project_id' => $completedProject->id,
                    'note' => 'Final handover, completion billing, and closeout documentation were completed. Design department values for computations are inherited from the linked source design project.',
                    'created_by' => $seedAdmin->id,
                    'created_at' => '2026-02-14 17:30:00',
                    'updated_at' => '2026-02-14 17:30:00',
                ],
            ]);

            $projectFiles = $this->projectFileRows($constructionProject, $seedAdmin, $assets);
            if ($projectFiles !== []) {
                ProjectFile::query()->insert($projectFiles);
            }

            $supportingFiles = array_merge(
                $this->supplementalProjectFileRows($designSourceProject, $seedAdmin, [
                    ['file_path' => $assets['guide'] ?? null, 'original_name' => 'Fortress-System-Flow-Guide.txt'],
                    ['file_path' => $assets['scope_site_1'] ?? null, 'original_name' => 'Fortress-Building-Design-Brief.jpg'],
                ], '2026-01-28 17:10:00'),
                $this->supplementalProjectFileRows($eligibleDesignProject, $seedAdmin, [
                    ['file_path' => $assets['scope_walling_1'] ?? null, 'original_name' => 'Fortress-Civic-Center-Concept-Revision.jpg'],
                ], '2026-03-05 16:45:00'),
                $this->supplementalProjectFileRows($pendingDesignProject, $seedAdmin, [
                    ['file_path' => $assets['scope_mep_1'] ?? null, 'original_name' => 'Fortress-Experience-Hub-MEP-Notes.jpg'],
                ], '2026-03-09 18:20:00'),
                $this->supplementalProjectFileRows($completedProject, $seedAdmin, [
                    ['file_path' => $assets['progress_4'] ?? null, 'original_name' => 'Fortress-Warehouse-Annex-Turnover.jpg'],
                ], '2026-02-14 17:40:00')
            );
            if ($supportingFiles !== []) {
                ProjectFile::query()->insert($supportingFiles);
            }

            Payment::query()->insert($this->designPaymentRows($designSourceProject));
            Payment::query()->insert($this->eligibleDesignPaymentRows($eligibleDesignProject));
            Payment::query()->insert($this->pendingDesignPaymentRows($pendingDesignProject));
            Payment::query()->insert($this->paymentRows($constructionProject));
            Payment::query()->insert($this->completedPaymentRows($completedProject));

            Expense::query()->insert($this->expenseRows($constructionProject));
            Expense::query()->insert($this->completedExpenseRows($completedProject));
            ProgressSubmitToken::query()->insert($this->tokenRows($constructionProject, $primaryForeman, $coForeman));

            $this->seedMonitoringBoardFlow($seedAdmin, $assets, $designSourceProject, $eligibleDesignProject);
            $this->seedPayrollFlow($constructionProject->id, $seedAdmin);
        });
    }

    private function createProjectRecord(array $attributes): Project
    {
        return Project::unguarded(fn () => Project::query()->create($attributes));
    }

    private function createMonitoringBoardItemRecord(array $attributes): MonitoringBoardItem
    {
        return MonitoringBoardItem::unguarded(fn () => MonitoringBoardItem::query()->create($attributes));
    }

    private function designSourceProjectAttributes(User $primaryForeman, User $coForeman): array
    {
        return [
            'name' => self::PROJECT_NAME,
            'client' => 'Fortress Property Holdings, Inc.',
            'type' => 'Commercial',
            'location' => 'Cebu City',
            'assigned_role' => 'Architect: Maria Santos; Engineer: Carlo Dizon; PM: Luis Mendoza',
            'assigned' => $primaryForeman->fullname . ', ' . $coForeman->fullname,
            'target' => '2026-06-30',
            'status' => 'PLANNING',
            'phase' => 'Design',
            'overall_progress' => 0,
            'contract_amount' => 280000.00,
            'design_fee' => 280000.00,
            'construction_cost' => 0,
            'total_client_payment' => 180000.00,
            'remaining_balance' => 100000.00,
            'last_paid_date' => '2026-01-27',
            'created_at' => '2026-01-08 08:30:00',
            'updated_at' => '2026-01-28 17:00:00',
        ];
    }

    private function eligibleDesignProjectAttributes(User $primaryForeman, User $coForeman): array
    {
        return [
            'name' => self::ELIGIBLE_DESIGN_PROJECT_NAME,
            'client' => 'Civic Prime Developments, Inc.',
            'type' => 'Institutional',
            'location' => 'Mandaue City',
            'assigned_role' => 'Architect: Maria Santos; Engineer: Carlo Dizon; PM: Luis Mendoza',
            'assigned' => $primaryForeman->fullname . ', ' . $coForeman->fullname,
            'target' => '2026-08-15',
            'status' => 'PLANNING',
            'phase' => 'Design',
            'overall_progress' => 0,
            'contract_amount' => 320000.00,
            'design_fee' => 320000.00,
            'construction_cost' => 0,
            'total_client_payment' => 250000.00,
            'remaining_balance' => 70000.00,
            'last_paid_date' => '2026-03-05',
            'created_at' => '2026-02-20 10:00:00',
            'updated_at' => '2026-03-05 16:40:00',
        ];
    }

    private function pendingDesignProjectAttributes(User $primaryForeman, User $coForeman): array
    {
        return [
            'name' => self::PENDING_DESIGN_PROJECT_NAME,
            'client' => 'Experience Ventures Group',
            'type' => 'Retail Interior',
            'location' => 'Lapu-Lapu City',
            'assigned_role' => 'Architect: Maria Santos; Engineer: Carlo Dizon; PM: Luis Mendoza',
            'assigned' => $primaryForeman->fullname . ', ' . $coForeman->fullname,
            'target' => '2026-09-30',
            'status' => 'PLANNING',
            'phase' => 'Design',
            'overall_progress' => 0,
            'contract_amount' => 260000.00,
            'design_fee' => 260000.00,
            'construction_cost' => 0,
            'total_client_payment' => 160000.00,
            'remaining_balance' => 100000.00,
            'last_paid_date' => '2026-03-01',
            'created_at' => '2026-03-01 09:45:00',
            'updated_at' => '2026-03-09 18:15:00',
        ];
    }

    private function completedProjectAttributes(User $primaryForeman, User $coForeman): array
    {
        return [
            'name' => self::COMPLETED_PROJECT_NAME,
            'client' => 'Warehouse Holdings Cebu',
            'type' => 'Warehouse Fit-Out',
            'location' => 'Talisay City',
            'assigned_role' => 'Architect: Maria Santos; Engineer: Carlo Dizon; PM: Luis Mendoza',
            'assigned' => $primaryForeman->fullname . ', ' . $coForeman->fullname,
            'target' => '2026-02-14',
            'status' => 'COMPLETED',
            'phase' => 'Completed',
            'overall_progress' => 100,
            'contract_amount' => 980000.00,
            'design_fee' => 150000.00,
            'construction_cost' => 720000.00,
            'total_client_payment' => 980000.00,
            'remaining_balance' => 0.00,
            'last_paid_date' => '2026-02-14',
            'created_at' => '2025-11-10 08:00:00',
            'updated_at' => '2026-02-14 17:30:00',
        ];
    }

    private function eligibleDesignTrackerAttributes(): array
    {
        return [
            'design_contract_amount' => 320000.00,
            'downpayment' => 120000.00,
            'total_received' => 250000.00,
            'office_payroll_deduction' => 18000.00,
            'design_progress' => 100,
            'client_approval_status' => 'approved',
        ];
    }

    private function pendingDesignTrackerAttributes(): array
    {
        return [
            'design_contract_amount' => 260000.00,
            'downpayment' => 100000.00,
            'total_received' => 160000.00,
            'office_payroll_deduction' => 12000.00,
            'design_progress' => 62,
            'client_approval_status' => 'pending',
        ];
    }

    private function completedBuildProjectAttributes(Project $project): array
    {
        return [
            'project_id' => $project->id,
            'construction_contract' => 830000.00,
            'total_client_payment' => 830000.00,
            'materials_cost' => 470000.00,
            'labor_cost' => 185000.00,
            'equipment_cost' => 65000.00,
        ];
    }

    private function supplementalProjectFileRows(Project $project, User $uploadedBy, array $files, string $timestamp): array
    {
        return collect($files)
            ->filter(fn (array $row) => !empty($row['file_path']))
            ->map(fn (array $row) => [
                'project_id' => $project->id,
                'file_path' => $row['file_path'],
                'original_name' => $row['original_name'],
                'uploaded_by' => $uploadedBy->id,
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ])
            ->values()
            ->all();
    }

    private function seedMonitoringBoardFlow(User $seedAdmin, array $assets, Project $designSourceProject, Project $eligibleDesignProject): void
    {
        $definitions = [
            [
                'attributes' => [
                    'department' => 'Autocad',
                    'client_name' => 'Fortress Property Holdings, Inc.',
                    'project_name' => self::PROJECT_NAME,
                    'project_type' => 'Commercial',
                    'location' => 'Cebu City',
                    'assigned_to' => 'Maria Santos, Carlo Dizon',
                    'status' => 'DONE',
                    'start_date' => '2026-01-05',
                    'timeline' => '4 weeks',
                    'due_date' => '2026-01-28',
                    'date_paid' => '2026-01-27',
                    'progress_percent' => 100,
                    'remarks' => 'Proposal-stage deliverables are complete. This item already converted into the Design project and has an active transferred Construction duplicate.',
                    'project_id' => $designSourceProject->id,
                    'converted_at' => '2026-01-28 16:55:00',
                    'created_by' => $seedAdmin->id,
                    'created_at' => '2026-01-05 09:00:00',
                    'updated_at' => '2026-01-28 16:55:00',
                ],
                'files' => [
                    ['file_path' => $assets['guide'] ?? null, 'original_name' => 'Fortress-System-Flow-Guide.txt', 'mime_type' => 'text/plain'],
                    ['file_path' => $assets['scope_site_1'] ?? null, 'original_name' => 'Fortress-Building-Site-Layout.jpg', 'mime_type' => 'image/jpeg'],
                ],
            ],
            [
                'attributes' => [
                    'department' => 'Architecture',
                    'client_name' => 'Civic Prime Developments, Inc.',
                    'project_name' => self::ELIGIBLE_DESIGN_PROJECT_NAME,
                    'project_type' => 'Institutional',
                    'location' => 'Mandaue City',
                    'assigned_to' => 'Maria Santos, Carlo Dizon',
                    'status' => 'DONE',
                    'start_date' => '2026-02-18',
                    'timeline' => '3 weeks',
                    'due_date' => '2026-03-05',
                    'date_paid' => '2026-03-05',
                    'progress_percent' => 100,
                    'remarks' => 'Converted from Monitoring Board to Design. Client approval is already Approved, but transfer to Construction has not been triggered yet.',
                    'project_id' => $eligibleDesignProject->id,
                    'converted_at' => '2026-03-05 16:35:00',
                    'created_by' => $seedAdmin->id,
                    'created_at' => '2026-02-18 09:15:00',
                    'updated_at' => '2026-03-05 16:35:00',
                ],
                'files' => [
                    ['file_path' => $assets['scope_structure_1'] ?? null, 'original_name' => 'Fortress-Civic-Center-Concept.jpg', 'mime_type' => 'image/jpeg'],
                ],
            ],
            [
                'attributes' => [
                    'department' => 'Architecture',
                    'client_name' => 'Harbor View Holdings',
                    'project_name' => 'Harbor View Dormitory',
                    'project_type' => 'Residential',
                    'location' => 'Lapu-Lapu City',
                    'assigned_to' => 'Maria Santos',
                    'status' => 'IN_REVIEW',
                    'start_date' => '2026-03-01',
                    'timeline' => '2 weeks',
                    'due_date' => '2026-03-16',
                    'date_paid' => null,
                    'progress_percent' => 65,
                    'remarks' => 'Client comments on room mix, fire exit alignment, and facade options are under review.',
                    'created_by' => $seedAdmin->id,
                    'created_at' => '2026-03-01 10:40:00',
                    'updated_at' => '2026-03-07 14:10:00',
                ],
                'files' => [
                    ['file_path' => $assets['progress_2'] ?? null, 'original_name' => 'Harbor-View-Dormitory-Elevation.jpg', 'mime_type' => 'image/jpeg'],
                ],
            ],
            [
                'attributes' => [
                    'department' => 'Engineering',
                    'client_name' => 'Cebu Retail Group',
                    'project_name' => 'Cebu Retail Arcade',
                    'project_type' => 'Commercial',
                    'location' => 'Cebu City',
                    'assigned_to' => 'Carlo Dizon',
                    'status' => 'PROPOSAL',
                    'start_date' => '2026-03-08',
                    'timeline' => '10 days',
                    'due_date' => '2026-03-18',
                    'date_paid' => null,
                    'progress_percent' => 25,
                    'remarks' => 'Initial site data and concept zoning have been collected, but the proposal package is still being assembled.',
                    'created_by' => $seedAdmin->id,
                    'created_at' => '2026-03-08 11:20:00',
                    'updated_at' => '2026-03-08 11:20:00',
                ],
                'files' => [
                    ['file_path' => $assets['scope_foundation_1'] ?? null, 'original_name' => 'Cebu-Retail-Arcade-Site-Reference.jpg', 'mime_type' => 'image/jpeg'],
                ],
            ],
            [
                'attributes' => [
                    'department' => 'Planning',
                    'client_name' => 'Northpoint Logistics Corp.',
                    'project_name' => 'Northpoint Logistics Hub',
                    'project_type' => 'Industrial',
                    'location' => 'Minglanilla',
                    'assigned_to' => 'Luis Mendoza',
                    'status' => 'APPROVED',
                    'start_date' => '2026-02-25',
                    'timeline' => '18 days',
                    'due_date' => '2026-03-20',
                    'date_paid' => '2026-03-03',
                    'progress_percent' => 90,
                    'remarks' => 'Commercial approval is already in place and the board record is close to conversion, but final mobilization details are still pending.',
                    'created_by' => $seedAdmin->id,
                    'created_at' => '2026-02-25 13:00:00',
                    'updated_at' => '2026-03-06 15:20:00',
                ],
                'files' => [
                    ['file_path' => $assets['scope_roofing_1'] ?? null, 'original_name' => 'Northpoint-Logistics-Hub-Reference.jpg', 'mime_type' => 'image/jpeg'],
                ],
            ],
        ];

        foreach ($definitions as $definition) {
            $item = $this->createMonitoringBoardItemRecord($definition['attributes']);

            $files = collect($definition['files'])
                ->filter(fn (array $file) => !empty($file['file_path']))
                ->map(fn (array $file) => [
                    'monitoring_board_item_id' => $item->id,
                    'file_path' => $file['file_path'],
                    'original_name' => $file['original_name'],
                    'mime_type' => $file['mime_type'] ?? null,
                    'uploaded_by' => $seedAdmin->id,
                    'created_at' => $definition['attributes']['updated_at'],
                    'updated_at' => $definition['attributes']['updated_at'],
                ])
                ->values()
                ->all();

            if ($files !== []) {
                MonitoringBoardFile::query()->insert($files);
            }
        }
    }

    private function projectAttributes(User $primaryForeman, User $coForeman): array
    {
        return [
            'name' => self::PROJECT_NAME,
            'client' => 'Fortress Property Holdings, Inc.',
            'type' => 'Commercial',
            'location' => 'Cebu City',
            'assigned_role' => 'Architect: Maria Santos; Engineer: Carlo Dizon; PM: Luis Mendoza',
            'assigned' => $primaryForeman->fullname . ', ' . $coForeman->fullname,
            'target' => '2026-06-30',
            'status' => 'ONGOING',
            'phase' => 'Construction',
            'overall_progress' => 62,
            'contract_amount' => 1520000.00,
            'design_fee' => 0.00,
            'construction_cost' => 435500.00,
            'total_client_payment' => 440000.00,
            'remaining_balance' => 1080000.00,
            'last_paid_date' => '2026-03-04',
            'created_at' => '2026-01-29 08:00:00',
            'updated_at' => '2026-03-08 18:30:00',
        ];
    }

    private function designProjectAttributes(Project $project): array
    {
        return [
            'project_id' => $project->id,
            'design_contract_amount' => 280000.00,
            'downpayment' => 80000.00,
            'total_received' => 180000.00,
            'office_payroll_deduction' => 15000.00,
            'design_progress' => 100,
            'client_approval_status' => 'approved',
        ];
    }

    private function buildProjectAttributes(Project $project): array
    {
        return [
            'project_id' => $project->id,
            'construction_contract' => 1520000.00,
            'total_client_payment' => 440000.00,
            'materials_cost' => 298000.00,
            'labor_cost' => 102500.00,
            'equipment_cost' => 35000.00,
        ];
    }

    private function projectAssignmentRows(Project $project, User $primaryForeman, User $coForeman): array
    {
        return [
            [
                'project_id' => $project->id,
                'user_id' => $coForeman->id,
                'role_in_project' => 'foreman',
                'created_at' => '2026-03-01 08:00:00',
                'updated_at' => '2026-03-01 08:00:00',
            ],
            [
                'project_id' => $project->id,
                'user_id' => $primaryForeman->id,
                'role_in_project' => 'foreman',
                'created_at' => '2026-03-01 08:05:00',
                'updated_at' => '2026-03-01 08:05:00',
            ],
        ];
    }

    private function workerSeedRows(User $primaryForeman, User $coForeman): array
    {
        return [
            [
                'foreman_id' => $primaryForeman->id,
                'name' => 'Ramon Castillo',
                'job_type' => 'Skilled Worker',
                'default_rate_per_hour' => 95.00,
                'birth_date' => '1988-04-11',
                'place_of_birth' => 'Toledo City',
                'sex' => 'male',
                'civil_status' => 'Married',
                'phone' => '09170000001',
                'address' => 'Poblacion, Toledo City',
            ],
            [
                'foreman_id' => $primaryForeman->id,
                'name' => 'Leo Navarro',
                'job_type' => 'Laborer',
                'default_rate_per_hour' => 92.00,
                'birth_date' => '1990-07-18',
                'place_of_birth' => 'Talisay City',
                'sex' => 'male',
                'civil_status' => 'Single',
                'phone' => '09170000002',
                'address' => 'Tabunok, Talisay City',
            ],
            [
                'foreman_id' => $primaryForeman->id,
                'name' => 'Joel Santos',
                'job_type' => 'Skilled Worker',
                'default_rate_per_hour' => 98.00,
                'birth_date' => '1987-02-06',
                'place_of_birth' => 'Mandaue City',
                'sex' => 'male',
                'civil_status' => 'Married',
                'phone' => '09170000003',
                'address' => 'Subangdaku, Mandaue City',
            ],
            [
                'foreman_id' => $primaryForeman->id,
                'name' => 'Carlo Belen',
                'job_type' => 'Worker',
                'default_rate_per_hour' => 88.00,
                'birth_date' => '1993-10-30',
                'place_of_birth' => 'Naga City',
                'sex' => 'male',
                'civil_status' => 'Single',
                'phone' => '09170000004',
                'address' => 'Colon, Naga City',
            ],
            [
                'foreman_id' => $primaryForeman->id,
                'name' => 'Alex Manuel',
                'job_type' => 'Skilled Worker',
                'default_rate_per_hour' => 100.00,
                'birth_date' => '1991-12-21',
                'place_of_birth' => 'Carcar City',
                'sex' => 'male',
                'civil_status' => 'Married',
                'phone' => '09170000005',
                'address' => 'Poblacion, Carcar City',
            ],
            [
                'foreman_id' => $coForeman->id,
                'name' => 'Mark Rivera',
                'job_type' => 'Laborer',
                'default_rate_per_hour' => 110.00,
                'birth_date' => '1994-08-15',
                'place_of_birth' => 'Lapu-Lapu City',
                'sex' => 'male',
                'civil_status' => 'Single',
                'phone' => '09170000006',
                'address' => 'Pajo, Lapu-Lapu City',
            ],
        ];
    }

    private function scopeSeedRows(User $primaryForeman, User $coForeman): array
    {
        return [
            [
                'scope_name' => 'Site Preparation and Layout',
                'assigned_personnel' => $primaryForeman->fullname,
                'progress_percent' => 100,
                'status' => 'COMPLETED',
                'remarks' => 'Temporary facilities, fencing, and layout lines are complete.',
                'contract_amount' => 150000.00,
                'weight_percent' => 8.00,
                'start_date' => '2026-01-05',
                'target_completion' => '2026-01-18',
            ],
            [
                'scope_name' => 'Foundation and Footings',
                'assigned_personnel' => $coForeman->fullname,
                'progress_percent' => 100,
                'status' => 'COMPLETED',
                'remarks' => 'Excavation, footing rebar, and concrete pour completed.',
                'contract_amount' => 280000.00,
                'weight_percent' => 18.00,
                'start_date' => '2026-01-12',
                'target_completion' => '2026-02-02',
            ],
            [
                'scope_name' => 'Structural Columns and Beams',
                'assigned_personnel' => $primaryForeman->fullname,
                'progress_percent' => 72,
                'status' => 'IN_PROGRESS',
                'remarks' => 'Level 2 beam forms are ready for the next concrete schedule.',
                'contract_amount' => 360000.00,
                'weight_percent' => 22.00,
                'start_date' => '2026-02-01',
                'target_completion' => '2026-03-22',
            ],
            [
                'scope_name' => 'CHB Walling and Plastering',
                'assigned_personnel' => $primaryForeman->fullname,
                'progress_percent' => 48,
                'status' => 'IN_PROGRESS',
                'remarks' => 'Ground floor walling is complete, second floor walling is ongoing.',
                'contract_amount' => 260000.00,
                'weight_percent' => 16.00,
                'start_date' => '2026-02-16',
                'target_completion' => '2026-04-10',
            ],
            [
                'scope_name' => 'Roofing and Waterproofing',
                'assigned_personnel' => $coForeman->fullname,
                'progress_percent' => 28,
                'status' => 'IN_PROGRESS',
                'remarks' => 'Roof framing is underway. Waterproofing crew is queued next.',
                'contract_amount' => 310000.00,
                'weight_percent' => 20.00,
                'start_date' => '2026-03-01',
                'target_completion' => '2026-05-02',
            ],
            [
                'scope_name' => 'Electrical and Plumbing Rough-In',
                'assigned_personnel' => $primaryForeman->fullname,
                'progress_percent' => 24,
                'status' => 'IN_PROGRESS',
                'remarks' => 'Primary conduits and vertical plumbing stacks are partially installed.',
                'contract_amount' => 180000.00,
                'weight_percent' => 16.00,
                'start_date' => '2026-03-03',
                'target_completion' => '2026-05-18',
            ],
        ];
    }

    private function scopePhotoRows(array $assets): array
    {
        return [
            ['scope' => 'Site Preparation and Layout', 'photo' => $assets['scope_site_1'] ?? null, 'caption' => '[Jotform Weekly] | Week: 2026-03-02 | Scope: Site Preparation and Layout | Mobilization area and layout points'],
            ['scope' => 'Foundation and Footings', 'photo' => $assets['scope_foundation_1'] ?? null, 'caption' => '[Jotform Weekly] | Week: 2026-03-02 | Scope: Foundation and Footings | Footing rebar inspection before pour'],
            ['scope' => 'Foundation and Footings', 'photo' => $assets['scope_foundation_2'] ?? null, 'caption' => '[Jotform Weekly] | Week: 2026-03-02 | Scope: Foundation and Footings | Completed footing concrete'],
            ['scope' => 'Structural Columns and Beams', 'photo' => $assets['scope_structure_1'] ?? null, 'caption' => '[Jotform Weekly] | Week: 2026-03-02 | Scope: Structural Columns and Beams | Level 2 beam formworks'],
            ['scope' => 'CHB Walling and Plastering', 'photo' => $assets['scope_walling_1'] ?? null, 'caption' => '[Jotform Weekly] | Week: 2026-03-02 | Scope: CHB Walling and Plastering | Ongoing wall alignment and plaster preparation'],
            ['scope' => 'Roofing and Waterproofing', 'photo' => $assets['scope_roofing_1'] ?? null, 'caption' => '[Jotform Weekly] | Week: 2026-03-02 | Scope: Roofing and Waterproofing | Roofing members ready for sheet installation'],
            ['scope' => 'Electrical and Plumbing Rough-In', 'photo' => $assets['scope_mep_1'] ?? null, 'caption' => '[Jotform Weekly] | Week: 2026-03-02 | Scope: Electrical and Plumbing Rough-In | Conduit and PVC layout in service area'],
        ];
    }

    private function projectWorkerRows(Project $project): array
    {
        return [
            [
                'project_id' => $project->id,
                'user_id' => null,
                'worker_name' => 'Rodel Crane Operator',
                'rate' => 150.00,
                'created_at' => '2026-03-01 09:00:00',
                'updated_at' => '2026-03-01 09:00:00',
            ],
            [
                'project_id' => $project->id,
                'user_id' => null,
                'worker_name' => 'Safety Officer Consultant',
                'rate' => 140.00,
                'created_at' => '2026-03-01 09:05:00',
                'updated_at' => '2026-03-01 09:05:00',
            ],
        ];
    }

    private function weeklyAccomplishmentRows(Project $project, User $primaryForeman, User $coForeman): array
    {
        return [
            ['foreman_id' => $primaryForeman->id, 'project_id' => $project->id, 'scope_of_work' => 'Site Preparation and Layout', 'percent_completed' => 100, 'week_start' => '2026-02-23', 'created_at' => '2026-02-28 18:00:00', 'updated_at' => '2026-02-28 18:00:00'],
            ['foreman_id' => $primaryForeman->id, 'project_id' => $project->id, 'scope_of_work' => 'Foundation and Footings', 'percent_completed' => 85, 'week_start' => '2026-02-23', 'created_at' => '2026-02-28 18:00:00', 'updated_at' => '2026-02-28 18:00:00'],
            ['foreman_id' => $primaryForeman->id, 'project_id' => $project->id, 'scope_of_work' => 'Structural Columns and Beams', 'percent_completed' => 54, 'week_start' => '2026-02-23', 'created_at' => '2026-02-28 18:00:00', 'updated_at' => '2026-02-28 18:00:00'],
            ['foreman_id' => $primaryForeman->id, 'project_id' => $project->id, 'scope_of_work' => 'CHB Walling and Plastering', 'percent_completed' => 26, 'week_start' => '2026-02-23', 'created_at' => '2026-02-28 18:00:00', 'updated_at' => '2026-02-28 18:00:00'],
            ['foreman_id' => $primaryForeman->id, 'project_id' => $project->id, 'scope_of_work' => 'Roofing and Waterproofing', 'percent_completed' => 12, 'week_start' => '2026-02-23', 'created_at' => '2026-02-28 18:00:00', 'updated_at' => '2026-02-28 18:00:00'],
            ['foreman_id' => $primaryForeman->id, 'project_id' => $project->id, 'scope_of_work' => 'Electrical and Plumbing Rough-In', 'percent_completed' => 8, 'week_start' => '2026-02-23', 'created_at' => '2026-02-28 18:00:00', 'updated_at' => '2026-02-28 18:00:00'],
            ['foreman_id' => $primaryForeman->id, 'project_id' => $project->id, 'scope_of_work' => 'Site Preparation and Layout', 'percent_completed' => 100, 'week_start' => '2026-03-02', 'created_at' => '2026-03-07 18:05:00', 'updated_at' => '2026-03-07 18:05:00'],
            ['foreman_id' => $primaryForeman->id, 'project_id' => $project->id, 'scope_of_work' => 'Foundation and Footings', 'percent_completed' => 100, 'week_start' => '2026-03-02', 'created_at' => '2026-03-07 18:05:00', 'updated_at' => '2026-03-07 18:05:00'],
            ['foreman_id' => $primaryForeman->id, 'project_id' => $project->id, 'scope_of_work' => 'Structural Columns and Beams', 'percent_completed' => 72, 'week_start' => '2026-03-02', 'created_at' => '2026-03-07 18:05:00', 'updated_at' => '2026-03-07 18:05:00'],
            ['foreman_id' => $primaryForeman->id, 'project_id' => $project->id, 'scope_of_work' => 'CHB Walling and Plastering', 'percent_completed' => 48, 'week_start' => '2026-03-02', 'created_at' => '2026-03-07 18:05:00', 'updated_at' => '2026-03-07 18:05:00'],
            ['foreman_id' => $primaryForeman->id, 'project_id' => $project->id, 'scope_of_work' => 'Roofing and Waterproofing', 'percent_completed' => 28, 'week_start' => '2026-03-02', 'created_at' => '2026-03-07 18:05:00', 'updated_at' => '2026-03-07 18:05:00'],
            ['foreman_id' => $primaryForeman->id, 'project_id' => $project->id, 'scope_of_work' => 'Electrical and Plumbing Rough-In', 'percent_completed' => 24, 'week_start' => '2026-03-02', 'created_at' => '2026-03-07 18:05:00', 'updated_at' => '2026-03-07 18:05:00'],
            ['foreman_id' => $coForeman->id, 'project_id' => $project->id, 'scope_of_work' => 'Structural Columns and Beams', 'percent_completed' => 68, 'week_start' => '2026-02-23', 'created_at' => '2026-02-28 18:20:00', 'updated_at' => '2026-02-28 18:20:00'],
            ['foreman_id' => $coForeman->id, 'project_id' => $project->id, 'scope_of_work' => 'Roofing and Waterproofing', 'percent_completed' => 10, 'week_start' => '2026-02-23', 'created_at' => '2026-02-28 18:20:00', 'updated_at' => '2026-02-28 18:20:00'],
            ['foreman_id' => $coForeman->id, 'project_id' => $project->id, 'scope_of_work' => 'Structural Columns and Beams', 'percent_completed' => 72, 'week_start' => '2026-03-02', 'created_at' => '2026-03-07 18:15:00', 'updated_at' => '2026-03-07 18:15:00'],
            ['foreman_id' => $coForeman->id, 'project_id' => $project->id, 'scope_of_work' => 'Roofing and Waterproofing', 'percent_completed' => 28, 'week_start' => '2026-03-02', 'created_at' => '2026-03-07 18:15:00', 'updated_at' => '2026-03-07 18:15:00'],
            ['foreman_id' => $coForeman->id, 'project_id' => $project->id, 'scope_of_work' => 'Electrical and Plumbing Rough-In', 'percent_completed' => 24, 'week_start' => '2026-03-02', 'created_at' => '2026-03-07 18:15:00', 'updated_at' => '2026-03-07 18:15:00'],
        ];
    }

    private function materialRequestRows(Project $project, User $primaryForeman, User $coForeman, array $assets): array
    {
        return [
            ['project_id' => $project->id, 'foreman_id' => $primaryForeman->id, 'material_name' => 'Cement', 'quantity' => '250', 'unit' => 'bags', 'remarks' => 'Needed for column pours and CHB laying for the next 5 working days.', 'status' => 'pending', 'photo_path' => $assets['material_request_1'] ?? null, 'created_at' => '2026-03-05 09:20:00', 'updated_at' => '2026-03-05 09:20:00'],
            ['project_id' => $project->id, 'foreman_id' => $primaryForeman->id, 'material_name' => 'Rebar', 'quantity' => '130', 'unit' => 'pcs', 'remarks' => '16mm bars for level 2 beam reinforcement.', 'status' => 'approved', 'photo_path' => $assets['material_request_2'] ?? null, 'created_at' => '2026-03-03 14:10:00', 'updated_at' => '2026-03-03 16:45:00'],
            ['project_id' => $project->id, 'foreman_id' => $coForeman->id, 'material_name' => 'PVC Pipe', 'quantity' => '40', 'unit' => 'lengths', 'remarks' => 'Sanitary line rough-in for service core and restroom block.', 'status' => 'pending', 'photo_path' => $assets['material_request_3'] ?? null, 'created_at' => '2026-03-06 08:35:00', 'updated_at' => '2026-03-06 08:35:00'],
            ['project_id' => $project->id, 'foreman_id' => $coForeman->id, 'material_name' => 'Electrical Wire', 'quantity' => '6', 'unit' => 'rolls', 'remarks' => 'Feeder and branch circuits for the admin office segment.', 'status' => 'approved', 'photo_path' => $assets['material_request_4'] ?? null, 'created_at' => '2026-03-04 10:05:00', 'updated_at' => '2026-03-04 13:40:00'],
        ];
    }

    private function issueRows(Project $project, User $primaryForeman, User $coForeman, array $assets): array
    {
        return [
            ['project_id' => $project->id, 'foreman_id' => $primaryForeman->id, 'issue_title' => 'Formwork alignment at stair core', 'description' => 'Stair core beam formwork needs minor realignment before the next concrete schedule.', 'severity' => 'high', 'status' => 'open', 'photo_path' => $assets['issue_1'] ?? null, 'created_at' => '2026-03-06 11:15:00', 'updated_at' => '2026-03-06 11:15:00'],
            ['project_id' => $project->id, 'foreman_id' => $primaryForeman->id, 'issue_title' => 'Rainwater ponding near stockpile', 'description' => 'Drainage channel was blocked after heavy rain. Temporary diversion was installed and issue is resolved.', 'severity' => 'medium', 'status' => 'resolved', 'photo_path' => $assets['issue_2'] ?? null, 'created_at' => '2026-03-04 15:35:00', 'updated_at' => '2026-03-05 08:05:00'],
            ['project_id' => $project->id, 'foreman_id' => $coForeman->id, 'issue_title' => 'Temporary power panel grounding', 'description' => 'Grounding wire and rod inspection is required before energizing the temporary power extension.', 'severity' => 'medium', 'status' => 'open', 'photo_path' => $assets['issue_3'] ?? null, 'created_at' => '2026-03-07 08:40:00', 'updated_at' => '2026-03-07 08:40:00'],
        ];
    }

    private function deliveryRows(Project $project, User $primaryForeman, User $coForeman, array $assets): array
    {
        return [
            ['project_id' => $project->id, 'foreman_id' => $primaryForeman->id, 'item_delivered' => 'Cement', 'quantity' => '150 bags', 'delivery_date' => '2026-03-03', 'supplier' => 'Cebu Prime Construction Supply', 'status' => 'received', 'photo_path' => $assets['delivery_1'] ?? null, 'created_at' => '2026-03-03 10:20:00', 'updated_at' => '2026-03-03 10:20:00'],
            ['project_id' => $project->id, 'foreman_id' => $primaryForeman->id, 'item_delivered' => 'Rebar 16mm', 'quantity' => '130 pcs', 'delivery_date' => '2026-03-04', 'supplier' => 'Metro Steel Cebu', 'status' => 'received', 'photo_path' => $assets['delivery_2'] ?? null, 'created_at' => '2026-03-04 16:00:00', 'updated_at' => '2026-03-04 16:00:00'],
            ['project_id' => $project->id, 'foreman_id' => $coForeman->id, 'item_delivered' => 'PVC Pipe', 'quantity' => '28 lengths', 'delivery_date' => '2026-03-06', 'supplier' => 'Lapu-Lapu Industrial Depot', 'status' => 'incomplete', 'photo_path' => $assets['delivery_3'] ?? null, 'created_at' => '2026-03-06 14:25:00', 'updated_at' => '2026-03-06 14:25:00'],
        ];
    }

    private function progressPhotoRows(Project $project, User $primaryForeman, User $coForeman, array $assets): array
    {
        return [
            ['foreman_id' => $primaryForeman->id, 'project_id' => $project->id, 'photo_path' => $assets['progress_1'] ?? null, 'caption' => '[General Progress] Beam and slab formworks staged for next week concrete pour.', 'created_at' => '2026-03-05 17:30:00', 'updated_at' => '2026-03-05 17:30:00'],
            ['foreman_id' => $primaryForeman->id, 'project_id' => $project->id, 'photo_path' => $assets['progress_2'] ?? null, 'caption' => '[Masonry] CHB walling on the ground floor west wing.', 'created_at' => '2026-03-06 17:45:00', 'updated_at' => '2026-03-06 17:45:00'],
            ['foreman_id' => $coForeman->id, 'project_id' => $project->id, 'photo_path' => $assets['progress_3'] ?? null, 'caption' => '[Plumbing Rough-in] PVC and clean-out runs ready for inspection.', 'created_at' => '2026-03-06 16:20:00', 'updated_at' => '2026-03-06 16:20:00'],
            ['foreman_id' => $coForeman->id, 'project_id' => $project->id, 'photo_path' => $assets['progress_4'] ?? null, 'caption' => '[Roofing] Truss and purlin installation continuing above the service area.', 'created_at' => '2026-03-07 15:55:00', 'updated_at' => '2026-03-07 15:55:00'],
        ];
    }

    private function projectUpdateRows(Project $project, User $seedAdmin, User $primaryForeman, User $coForeman): array
    {
        return [
            ['project_id' => $project->id, 'note' => 'Project kickoff completed with approved design package, survey references, and manpower deployment plan.', 'created_by' => $seedAdmin->id, 'created_at' => '2026-01-05 09:00:00', 'updated_at' => '2026-01-05 09:00:00'],
            ['project_id' => $project->id, 'note' => 'Foundation and footing activities reached 100% completion after concrete cure inspection.', 'created_by' => $primaryForeman->id, 'created_at' => '2026-02-02 17:10:00', 'updated_at' => '2026-02-02 17:10:00'],
            ['project_id' => $project->id, 'note' => 'Structural columns and beams reached 72%. Rebar and formworks for the remaining frames are staged.', 'created_by' => $primaryForeman->id, 'created_at' => '2026-03-05 18:10:00', 'updated_at' => '2026-03-05 18:10:00'],
            ['project_id' => $project->id, 'note' => 'Electrical and plumbing rough-in is now active in parallel with roofing preparation for the next billing cycle.', 'created_by' => $coForeman->id, 'created_at' => '2026-03-07 18:00:00', 'updated_at' => '2026-03-07 18:00:00'],
        ];
    }

    private function projectFileRows(Project $project, User $seedAdmin, array $assets): array
    {
        return collect([
            ['file_path' => $assets['guide'] ?? null, 'original_name' => 'Fortress-System-Flow-Guide.txt'],
            ['file_path' => $assets['scope_structure_1'] ?? null, 'original_name' => 'Fortress-Building-Structural-Progress.jpg'],
            ['file_path' => $assets['scope_roofing_1'] ?? null, 'original_name' => 'Fortress-Building-Roofing-Progress.jpg'],
            ['file_path' => $assets['scope_mep_1'] ?? null, 'original_name' => 'Fortress-Building-MEP-Progress.jpg'],
        ])
            ->filter(fn (array $row) => !empty($row['file_path']))
            ->map(fn (array $row) => [
                'project_id' => $project->id,
                'file_path' => $row['file_path'],
                'original_name' => $row['original_name'],
                'uploaded_by' => $seedAdmin->id,
                'created_at' => '2026-03-07 18:30:00',
                'updated_at' => '2026-03-07 18:30:00',
            ])
            ->values()
            ->all();
    }

    private function designPaymentRows(Project $project): array
    {
        return [
            ['project_id' => $project->id, 'amount' => 80000.00, 'date_paid' => '2026-01-10', 'reference' => 'FPH-DES-260110', 'note' => 'Design mobilization downpayment for schematic package work.', 'created_at' => '2026-01-10 11:00:00', 'updated_at' => '2026-01-10 11:00:00'],
            ['project_id' => $project->id, 'amount' => 100000.00, 'date_paid' => '2026-01-27', 'reference' => 'FPH-DES-260127', 'note' => 'Additional design billing after approved proposal and coordinated drawing issuance.', 'created_at' => '2026-01-27 15:30:00', 'updated_at' => '2026-01-27 15:30:00'],
        ];
    }

    private function eligibleDesignPaymentRows(Project $project): array
    {
        return [
            ['project_id' => $project->id, 'amount' => 120000.00, 'date_paid' => '2026-02-22', 'reference' => 'CIV-DES-260222', 'note' => 'Approved concept retainer and planning package release.', 'created_at' => '2026-02-22 13:20:00', 'updated_at' => '2026-02-22 13:20:00'],
            ['project_id' => $project->id, 'amount' => 130000.00, 'date_paid' => '2026-03-05', 'reference' => 'CIV-DES-260305', 'note' => 'Second design billing after client approval of the final scheme.', 'created_at' => '2026-03-05 15:50:00', 'updated_at' => '2026-03-05 15:50:00'],
        ];
    }

    private function pendingDesignPaymentRows(Project $project): array
    {
        return [
            ['project_id' => $project->id, 'amount' => 100000.00, 'date_paid' => '2026-03-01', 'reference' => 'EXP-DES-260301', 'note' => 'Initial design retainer for mood boards, space planning, and MEP coordination.', 'created_at' => '2026-03-01 14:00:00', 'updated_at' => '2026-03-01 14:00:00'],
            ['project_id' => $project->id, 'amount' => 60000.00, 'date_paid' => '2026-03-08', 'reference' => 'EXP-DES-260308', 'note' => 'Interim design billing while waiting for final client approval.', 'created_at' => '2026-03-08 16:30:00', 'updated_at' => '2026-03-08 16:30:00'],
        ];
    }

    private function paymentRows(Project $project): array
    {
        return [
            ['project_id' => $project->id, 'amount' => 120000.00, 'date_paid' => '2026-01-31', 'reference' => 'FPH-CON-260131', 'note' => 'Construction mobilization for footing excavation, fencing, and temporary facilities.', 'created_at' => '2026-01-31 10:45:00', 'updated_at' => '2026-01-31 10:45:00'],
            ['project_id' => $project->id, 'amount' => 140000.00, 'date_paid' => '2026-02-18', 'reference' => 'FPH-CON-260218', 'note' => 'Progress billing tied to footing completion and initial framing accomplishments.', 'created_at' => '2026-02-18 15:00:00', 'updated_at' => '2026-02-18 15:00:00'],
            ['project_id' => $project->id, 'amount' => 180000.00, 'date_paid' => '2026-03-04', 'reference' => 'FPH-CON-260304', 'note' => 'March progress billing covering structural works, masonry, and roofing preparation.', 'created_at' => '2026-03-04 16:20:00', 'updated_at' => '2026-03-04 16:20:00'],
        ];
    }

    private function completedPaymentRows(Project $project): array
    {
        return [
            ['project_id' => $project->id, 'amount' => 250000.00, 'date_paid' => '2025-12-05', 'reference' => 'WHA-DEP-251205', 'note' => 'Design approval and mobilization billing.', 'created_at' => '2025-12-05 11:20:00', 'updated_at' => '2025-12-05 11:20:00'],
            ['project_id' => $project->id, 'amount' => 330000.00, 'date_paid' => '2026-01-09', 'reference' => 'WHA-PROG-260109', 'note' => 'Structural and envelope progress billing.', 'created_at' => '2026-01-09 14:15:00', 'updated_at' => '2026-01-09 14:15:00'],
            ['project_id' => $project->id, 'amount' => 400000.00, 'date_paid' => '2026-02-14', 'reference' => 'WHA-FIN-260214', 'note' => 'Final billing after turnover, punch-list closure, and handover documents.', 'created_at' => '2026-02-14 16:50:00', 'updated_at' => '2026-02-14 16:50:00'],
        ];
    }

    private function expenseRows(Project $project): array
    {
        return [
            ['project_id' => $project->id, 'category' => 'Cement', 'amount' => 98000.00, 'note' => 'Footing and masonry batch releases.', 'date' => '2026-02-05', 'created_at' => '2026-02-05 10:00:00', 'updated_at' => '2026-02-05 10:00:00'],
            ['project_id' => $project->id, 'category' => 'Rebar', 'amount' => 124500.00, 'note' => 'Column and beam reinforcement packages.', 'date' => '2026-02-24', 'created_at' => '2026-02-24 14:00:00', 'updated_at' => '2026-02-24 14:00:00'],
            ['project_id' => $project->id, 'category' => 'Labor', 'amount' => 102500.00, 'note' => 'March 2-8 payroll accrual for the active site team.', 'date' => '2026-03-08', 'created_at' => '2026-03-08 18:00:00', 'updated_at' => '2026-03-08 18:00:00'],
            ['project_id' => $project->id, 'category' => 'Equipment Rental', 'amount' => 35000.00, 'note' => 'Mixer, vibrators, and scaffolding rental cycle.', 'date' => '2026-03-01', 'created_at' => '2026-03-01 08:30:00', 'updated_at' => '2026-03-01 08:30:00'],
            ['project_id' => $project->id, 'category' => 'Electrical Wire', 'amount' => 27000.00, 'note' => 'Initial rough-in feeder and branch wire purchase.', 'date' => '2026-03-04', 'created_at' => '2026-03-04 13:00:00', 'updated_at' => '2026-03-04 13:00:00'],
            ['project_id' => $project->id, 'category' => 'PVC Pipe', 'amount' => 18500.00, 'note' => 'Sanitary and water line rough-in materials.', 'date' => '2026-03-06', 'created_at' => '2026-03-06 11:10:00', 'updated_at' => '2026-03-06 11:10:00'],
            ['project_id' => $project->id, 'category' => 'Miscellaneous', 'amount' => 30000.00, 'note' => 'Fasteners, safety stock, hauling, and site consumables.', 'date' => '2026-03-07', 'created_at' => '2026-03-07 17:10:00', 'updated_at' => '2026-03-07 17:10:00'],
        ];
    }

    private function completedExpenseRows(Project $project): array
    {
        return [
            ['project_id' => $project->id, 'category' => 'Steel and Roofing', 'amount' => 290000.00, 'note' => 'Main structure and roofing package.', 'date' => '2025-12-22', 'created_at' => '2025-12-22 09:30:00', 'updated_at' => '2025-12-22 09:30:00'],
            ['project_id' => $project->id, 'category' => 'Concrete and Masonry', 'amount' => 180000.00, 'note' => 'Footings, slab-on-grade, and masonry walls.', 'date' => '2026-01-05', 'created_at' => '2026-01-05 11:15:00', 'updated_at' => '2026-01-05 11:15:00'],
            ['project_id' => $project->id, 'category' => 'Labor', 'amount' => 185000.00, 'note' => 'Average manpower cost across the fit-out period.', 'date' => '2026-02-01', 'created_at' => '2026-02-01 17:30:00', 'updated_at' => '2026-02-01 17:30:00'],
            ['project_id' => $project->id, 'category' => 'Equipment Rental', 'amount' => 65000.00, 'note' => 'Scaffolding, welding set, and lifting equipment.', 'date' => '2026-01-20', 'created_at' => '2026-01-20 10:45:00', 'updated_at' => '2026-01-20 10:45:00'],
        ];
    }

    private function tokenRows(Project $project, User $primaryForeman, User $coForeman): array
    {
        return [
            ['project_id' => $project->id, 'foreman_id' => $primaryForeman->id, 'token' => self::PRIMARY_TOKEN, 'expires_at' => '2031-02-24 04:02:00', 'revoked_at' => null, 'last_submitted_at' => '2026-03-07 18:05:00', 'submission_count' => 4, 'created_at' => '2026-03-01 08:00:00', 'updated_at' => '2026-03-07 18:05:00'],
            ['project_id' => $project->id, 'foreman_id' => $coForeman->id, 'token' => self::CO_TOKEN, 'expires_at' => '2031-03-10 04:02:00', 'revoked_at' => null, 'last_submitted_at' => '2026-03-07 18:15:00', 'submission_count' => 2, 'created_at' => '2026-03-01 08:10:00', 'updated_at' => '2026-03-07 18:15:00'],
        ];
    }

    private function ensureMaterialCategories(): void
    {
        $materials = [
            ['name' => 'Cement', 'description' => 'Bulk cement for concrete and masonry works.'],
            ['name' => 'Rebar', 'description' => 'Steel reinforcement for structural concrete members.'],
            ['name' => 'Electrical Wire', 'description' => 'Wire and cable used for rough-in and fit-out.'],
            ['name' => 'PVC Pipe', 'description' => 'PVC piping for sanitary and water line installation.'],
            ['name' => 'Labor', 'description' => 'Labor cost bucket for payroll and site manpower.'],
            ['name' => 'Equipment Rental', 'description' => 'Rented equipment and temporary tools used on site.'],
            ['name' => 'Miscellaneous', 'description' => 'Site consumables, hauling, and support purchases.'],
            ['name' => 'Waterproofing Membrane', 'description' => 'Roofing and wet area waterproofing system material.'],
        ];

        foreach ($materials as $material) {
            Material::query()->updateOrCreate(
                ['name' => $material['name']],
                ['description' => $material['description']]
            );
        }
    }

    private function seedUserDetail(User $user, array $detailData): void
    {
        UserDetail::query()->updateOrCreate(['user_id' => $user->id], $detailData);
    }

    private function cleanupDatabaseExceptUsersAndUserDetails(): void
    {
        Storage::disk('public')->deleteDirectory(self::ASSET_ROOT);

        $tables = collect($this->allTableNames())
            ->reject(fn (string $table) => in_array($table, ['users', 'user_details', 'migrations'], true))
            ->values();

        Schema::disableForeignKeyConstraints();
        try {
            foreach ($tables as $table) {
                DB::table($table)->truncate();
            }
        } finally {
            Schema::enableForeignKeyConstraints();
        }
    }

    private function allTableNames(): array
    {
        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            return collect(DB::select('SHOW TABLES'))
                ->map(fn ($row) => (string) array_values((array) $row)[0])
                ->values()
                ->all();
        }

        if ($driver === 'pgsql') {
            return collect(DB::select("SELECT tablename FROM pg_tables WHERE schemaname = 'public'"))
                ->map(fn ($row) => (string) $row->tablename)
                ->values()
                ->all();
        }

        if ($driver === 'sqlite') {
            return collect(DB::select("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"))
                ->map(fn ($row) => (string) $row->name)
                ->values()
                ->all();
        }

        if ($driver === 'sqlsrv') {
            return collect(DB::select('SELECT name FROM sys.tables'))
                ->map(fn ($row) => (string) $row->name)
                ->values()
                ->all();
        }

        return [];
    }

    private function buildAttendanceRows(int $projectId, User $primaryForeman, User $coForeman, array $workerSeedRows): array
    {
        $rows = [];
        $workerRoleByName = collect($workerSeedRows)
            ->mapWithKeys(fn (array $worker) => [
                trim((string) ($worker['name'] ?? '')) => trim((string) ($worker['job_type'] ?? 'Worker')) ?: 'Worker',
            ]);

        $foremanLogs = [
            [
                'foreman' => $primaryForeman,
                'worker_name' => $primaryForeman->fullname,
                'entries' => [
                    ['date' => '2026-02-23', 'time_in' => '07:15', 'time_out' => '17:05'],
                    ['date' => '2026-02-24', 'time_in' => '07:18', 'time_out' => '17:10'],
                    ['date' => '2026-02-25', 'time_in' => '07:12', 'time_out' => '17:03'],
                    ['date' => '2026-02-26', 'time_in' => '07:20', 'time_out' => '17:18'],
                    ['date' => '2026-02-27', 'time_in' => '07:10', 'time_out' => '16:58'],
                    ['date' => '2026-02-28', 'time_in' => '07:25', 'time_out' => '15:35'],
                    ['date' => '2026-03-02', 'time_in' => '07:08', 'time_out' => '17:02'],
                    ['date' => '2026-03-03', 'time_in' => '07:15', 'time_out' => '17:12'],
                    ['date' => '2026-03-04', 'time_in' => '07:10', 'time_out' => '17:00'],
                    ['date' => '2026-03-05', 'time_in' => '07:05', 'time_out' => '17:18'],
                    ['date' => '2026-03-06', 'time_in' => '07:18', 'time_out' => '17:09'],
                    ['date' => '2026-03-07', 'time_in' => '07:22', 'time_out' => '15:48'],
                ],
            ],
            [
                'foreman' => $coForeman,
                'worker_name' => $coForeman->fullname,
                'entries' => [
                    ['date' => '2026-02-23', 'time_in' => '07:32', 'time_out' => '16:48'],
                    ['date' => '2026-02-24', 'time_in' => '07:28', 'time_out' => '17:00'],
                    ['date' => '2026-02-25', 'time_in' => '07:35', 'time_out' => '16:55'],
                    ['date' => '2026-02-26', 'time_in' => '07:30', 'time_out' => '17:08'],
                    ['date' => '2026-02-27', 'time_in' => '07:40', 'time_out' => '16:45'],
                    ['date' => '2026-02-28', 'time_in' => '07:42', 'time_out' => '15:18'],
                    ['date' => '2026-03-02', 'time_in' => '07:30', 'time_out' => '16:54'],
                    ['date' => '2026-03-03', 'time_in' => '07:26', 'time_out' => '16:58'],
                    ['date' => '2026-03-04', 'time_in' => '07:38', 'time_out' => '17:04'],
                    ['date' => '2026-03-05', 'time_in' => '07:40', 'time_out' => '17:16'],
                    ['date' => '2026-03-06', 'time_in' => '07:28', 'time_out' => '17:10'],
                    ['date' => '2026-03-07', 'time_in' => '07:36', 'time_out' => '15:20'],
                ],
            ],
        ];

        foreach ($foremanLogs as $definition) {
            foreach ($definition['entries'] as $entry) {
                $timestamp = Carbon::parse($entry['date'])->setTime(18, 0, 0)->toDateTimeString();
                $rows[] = [
                    'foreman_id' => $definition['foreman']->id,
                    'project_id' => $projectId,
                    'worker_name' => $definition['worker_name'],
                    'worker_role' => 'Foreman',
                    'date' => $entry['date'],
                    'time_in' => $entry['time_in'],
                    'time_out' => $entry['time_out'],
                    'hours' => $this->hoursBetween($entry['time_in'], $entry['time_out']),
                    'attendance_code' => null,
                    'selfie_path' => null,
                    'created_at' => $timestamp,
                    'updated_at' => $timestamp,
                ];
            }
        }

        $workerWeeklyCodes = [
            ['foreman' => $primaryForeman, 'worker_name' => 'Ramon Castillo', 'weeks' => ['2026-02-23' => ['P', 'P', 'P', 'P', 'P', 'P', 'R'], '2026-03-02' => ['P', 'P', 'P', 'P', 'P', 'P', 'R']]],
            ['foreman' => $primaryForeman, 'worker_name' => 'Leo Navarro', 'weeks' => ['2026-02-23' => ['P', 'P', 'P', 'P', 'H', 'P', 'R'], '2026-03-02' => ['P', 'P', 'H', 'P', 'P', 'A', 'R']]],
            ['foreman' => $primaryForeman, 'worker_name' => 'Joel Santos', 'weeks' => ['2026-02-23' => ['P', 'P', 'P', 'P', 'P', 'P', 'R'], '2026-03-02' => ['P', 'P', 'P', 'P', 'P', 'P', 'R']]],
            ['foreman' => $primaryForeman, 'worker_name' => 'Carlo Belen', 'weeks' => ['2026-02-23' => ['P', 'P', 'P', 'H', 'P', 'P', 'R'], '2026-03-02' => ['P', 'P', 'P', 'H', 'P', 'P', 'R']]],
            ['foreman' => $primaryForeman, 'worker_name' => 'Alex Manuel', 'weeks' => ['2026-02-23' => ['P', 'A', 'P', 'P', 'P', 'P', 'R'], '2026-03-02' => ['P', 'A', 'P', 'P', 'P', 'P', 'R']]],
            ['foreman' => $coForeman, 'worker_name' => 'Mark Rivera', 'weeks' => ['2026-02-23' => ['P', 'P', 'P', 'P', 'P', 'H', 'R'], '2026-03-02' => ['P', 'P', 'P', 'P', 'P', 'H', 'R']]],
        ];

        foreach ($workerWeeklyCodes as $workerDefinition) {
            foreach ($workerDefinition['weeks'] as $weekStart => $codes) {
                $weekStartDate = Carbon::parse($weekStart);

                foreach ($codes as $offset => $code) {
                    $date = $weekStartDate->copy()->addDays($offset);
                    $timestamp = $date->copy()->setTime(18, 10, 0)->toDateTimeString();
                    $rows[] = [
                        'foreman_id' => $workerDefinition['foreman']->id,
                        'project_id' => $projectId,
                        'worker_name' => $workerDefinition['worker_name'],
                        'worker_role' => $workerRoleByName->get($workerDefinition['worker_name'], 'Worker'),
                        'date' => $date->toDateString(),
                        'time_in' => null,
                        'time_out' => null,
                        'hours' => self::ATTENDANCE_CODE_HOURS[$code] ?? 0,
                        'attendance_code' => $code,
                        'selfie_path' => null,
                        'created_at' => $timestamp,
                        'updated_at' => $timestamp,
                    ];
                }
            }
        }

        return $rows;
    }

    private function seedPayrollFlow(int $projectId, User $payrollUser): void
    {
        $cutoff = PayrollCutoff::query()->firstOrCreate(
            ['start_date' => self::PAYROLL_WEEK_START, 'end_date' => self::PAYROLL_WEEK_END],
            ['status' => 'generated']
        );

        $attendanceSummary = Attendance::query()
            ->where('project_id', $projectId)
            ->whereBetween('date', [self::PAYROLL_WEEK_START, self::PAYROLL_WEEK_END])
            ->selectRaw('worker_name, worker_role, COALESCE(SUM(hours), 0) as total_hours')
            ->groupBy('worker_name', 'worker_role')
            ->orderBy('worker_name')
            ->get();

        foreach ($attendanceSummary as $row) {
            $hours = round((float) ($row->total_hours ?? 0), 2);
            $rate = $row->worker_role === 'Foreman'
                ? (float) (User::query()->where('fullname', $row->worker_name)->value('default_rate_per_hour') ?? 0)
                : (float) (Worker::query()->where('project_id', $projectId)->where('name', $row->worker_name)->value('default_rate_per_hour') ?? 0);
            $gross = round($hours * $rate, 2);

            Payroll::query()->create([
                'user_id' => $payrollUser->id,
                'cutoff_id' => $cutoff->id,
                'worker_name' => $row->worker_name,
                'role' => $row->worker_role ?: 'Labor',
                'hours' => $hours,
                'rate_per_hour' => $rate,
                'gross' => $gross,
                'deductions' => 0,
                'net' => $gross,
                'status' => 'ready',
                'week_start' => self::PAYROLL_WEEK_START,
            ]);
        }

        $deductions = [
            'Ramon Castillo' => [
                ['type' => 'cash_advance', 'amount' => 750.00, 'note' => 'Cash advance for family medical support.'],
            ],
            'Alex Manuel' => [
                ['type' => 'loan', 'amount' => 1200.00, 'note' => 'Tools payment installment.'],
                ['type' => 'other', 'amount' => 250.00, 'note' => 'Safety PPE replacement charge.'],
            ],
            'Fortress Demo Co-Foreman' => [
                ['type' => 'other', 'amount' => 500.00, 'note' => 'Site communication allowance offset.'],
            ],
        ];

        foreach ($deductions as $workerName => $items) {
            $payroll = Payroll::query()->where('cutoff_id', $cutoff->id)->where('worker_name', $workerName)->first();

            if (!$payroll) {
                continue;
            }

            foreach ($items as $item) {
                PayrollDeduction::query()->create([
                    'payroll_id' => $payroll->id,
                    'type' => $item['type'],
                    'amount' => $item['amount'],
                    'note' => $item['note'],
                ]);
            }

            $deductionTotal = round((float) PayrollDeduction::query()->where('payroll_id', $payroll->id)->sum('amount'), 2);
            $payroll->update([
                'deductions' => $deductionTotal,
                'net' => round((float) $payroll->gross - $deductionTotal, 2),
            ]);
        }

        $cutoff->update(['status' => 'generated']);
    }

    private function hoursBetween(string $timeIn, string $timeOut): float
    {
        $start = Carbon::createFromFormat('H:i', $timeIn);
        $end = Carbon::createFromFormat('H:i', $timeOut);

        if ($end->lessThan($start)) {
            $end->addDay();
        }

        return round($start->diffInMinutes($end) / 60, 1);
    }

    private function prepareAssets(): array
    {
        $baseUrl = rtrim((string) config('app.url', 'http://127.0.0.1:8000'), '/');
        $guidePath = self::ASSET_ROOT . '/Fortress-System-Flow-Guide.txt';

        Storage::disk('public')->put($guidePath, implode(PHP_EOL, [
            'Fortress system demo flow guide',
            '',
            'Logins:',
            '- Head Admin: headadmin@buildbooks.com / password',
            '- Demo Foreman: ' . self::PRIMARY_FOREMAN_EMAIL . ' / password',
            '- Demo Co-Foreman: ' . self::CO_FOREMAN_EMAIL . ' / password',
            '',
            'Monitoring Board demo records:',
            '- Fortress Building | DONE | converted into the Design source project and already linked to a Construction duplicate.',
            '- Fortress Civic Center | DONE | converted into a Design project that is approved and ready for manual transfer.',
            '- Harbor View Dormitory | IN_REVIEW | active proposal-stage example.',
            '- Cebu Retail Arcade | PROPOSAL | early-stage proposal example.',
            '- Northpoint Logistics Hub | APPROVED | near-conversion example.',
            '',
            'Projects Kanban demo records:',
            '- Fortress Building | Design | approved at 100%, transfer already used, kept as the source project.',
            '- Fortress Building | Construction | active duplicate linked through source_project_id with scopes, files, uploads, and payroll data.',
            '- Fortress Civic Center | Design | approved at 100%, not yet transferred so the Transfer to Construction button can be tested.',
            '- Fortress Experience Hub | Design | pending approval, so transfer should remain unavailable.',
            '- Fortress Warehouse Annex | Completed | sample closed project where Design computations are retained through source_project_id linkage.',
            '',
            'Flow walkthrough:',
            '1. Proposal work starts in Monitoring Board with files and status progression.',
            '2. A Monitoring Board item reaches 100% and is considered converted into a Design project.',
            '3. Design progress is driven from design billing plus approval status, not from construction scopes.',
            '4. Approved Design projects can be manually transferred from the Kanban card into a duplicated Construction project.',
            '5. Construction progress is driven by project scopes, weekly accomplishments, attendance, uploads, expenses, and payments.',
            '6. Construction projects can be manually transferred to Completed from the Kanban card.',
            '',
            'Public links:',
            '- Main Jotform flow: ' . $baseUrl . '/progress-submit/' . self::PRIMARY_TOKEN,
            '- Main receipt: ' . $baseUrl . '/progress-receipt/' . self::PRIMARY_TOKEN,
            '- Co-foreman flow: ' . $baseUrl . '/progress-submit/' . self::CO_TOKEN,
            '- Co-foreman receipt: ' . $baseUrl . '/progress-receipt/' . self::CO_TOKEN,
            '',
            'What is seeded:',
            '- Monitoring Board items in Proposal, In Review, Approved, and Done states, with attached files.',
            '- Three design-stage examples: transferred, transfer-ready, and approval-pending.',
            '- One active construction project with design linkage, scopes, scope photos, workers, attendance, weekly accomplishments, issues, deliveries, progress photos, updates, files, payments, expenses, payroll, and submission tokens.',
            '- One completed project with closeout payments, expenses, files, updates, and retained Design computations via source_project_id.',
            '- A text guide file attached to both projects and monitoring entries to explain the seeded workflow.',
        ]));

        return [
            'guide' => $guidePath,
            'primary_profile' => $this->copySampleImage('profiles/fortress-demo-foreman', ['20260129_213145.jpg', '20260129_213145 (1).jpg'], 0),
            'co_profile' => $this->copySampleImage('profiles/fortress-demo-co-foreman', ['20260129_213532.jpg', '20260129_213532 (1).jpg'], 1),
            'scope_site_1' => $this->copySampleImage('scopes/site-preparation-1', ['20251018_073117.jpg', '20251018_073117 (1).jpg'], 2),
            'scope_foundation_1' => $this->copySampleImage('scopes/foundation-1', ['20251018_073153.jpg', '20251018_073153 (1).jpg'], 3),
            'scope_foundation_2' => $this->copySampleImage('scopes/foundation-2', ['20251222_194419.jpg'], 4),
            'scope_structure_1' => $this->copySampleImage('scopes/structure-1', ['20260129_213145.jpg', '20260129_213145 (1).jpg'], 5),
            'scope_walling_1' => $this->copySampleImage('scopes/walling-1', ['20260129_213532.jpg', '20260129_213532 (1).jpg'], 6),
            'scope_roofing_1' => $this->copySampleImage('scopes/roofing-1', ['20251018_073117.jpg', '20251018_073117 (1).jpg'], 7),
            'scope_mep_1' => $this->copySampleImage('scopes/mep-1', ['20251018_073153.jpg', '20251018_073153 (1).jpg'], 8),
            'material_request_1' => $this->copySampleImage('requests/material-cement', ['20251222_194419.jpg'], 4),
            'material_request_2' => $this->copySampleImage('requests/material-rebar', ['20260129_213145.jpg', '20260129_213145 (1).jpg'], 5),
            'material_request_3' => $this->copySampleImage('requests/material-pvc', ['20260129_213532.jpg', '20260129_213532 (1).jpg'], 6),
            'material_request_4' => $this->copySampleImage('requests/material-wire', ['20251018_073153.jpg', '20251018_073153 (1).jpg'], 8),
            'issue_1' => $this->copySampleImage('issues/formwork-alignment', ['20260129_213145.jpg', '20260129_213145 (1).jpg'], 5),
            'issue_2' => $this->copySampleImage('issues/ponding', ['20251018_073117.jpg', '20251018_073117 (1).jpg'], 2),
            'issue_3' => $this->copySampleImage('issues/power-panel', ['20251018_073153.jpg', '20251018_073153 (1).jpg'], 3),
            'delivery_1' => $this->copySampleImage('deliveries/cement', ['20251222_194419.jpg'], 4),
            'delivery_2' => $this->copySampleImage('deliveries/rebar', ['20260129_213145.jpg', '20260129_213145 (1).jpg'], 5),
            'delivery_3' => $this->copySampleImage('deliveries/pvc', ['20260129_213532.jpg', '20260129_213532 (1).jpg'], 6),
            'progress_1' => $this->copySampleImage('progress/general-1', ['20260129_213145.jpg', '20260129_213145 (1).jpg'], 5),
            'progress_2' => $this->copySampleImage('progress/general-2', ['20260129_213532.jpg', '20260129_213532 (1).jpg'], 6),
            'progress_3' => $this->copySampleImage('progress/general-3', ['20251018_073153.jpg', '20251018_073153 (1).jpg'], 3),
            'progress_4' => $this->copySampleImage('progress/general-4', ['20251018_073117.jpg', '20251018_073117 (1).jpg'], 2),
        ];
    }

    private function copySampleImage(string $relativeTargetBase, array $preferredNames = [], ?int $fallbackIndex = null): ?string
    {
        $sourcePath = $this->resolveSampleImage($preferredNames, $fallbackIndex);

        if (!$sourcePath || !File::exists($sourcePath)) {
            return null;
        }

        $extension = strtolower((string) pathinfo($sourcePath, PATHINFO_EXTENSION));
        $destination = trim(self::ASSET_ROOT . '/' . $relativeTargetBase . '.' . $extension, '/');
        $targetPath = storage_path('app/public/' . $destination);

        File::ensureDirectoryExists(dirname($targetPath));
        File::copy($sourcePath, $targetPath);

        return $destination;
    }

    private function resolveSampleImage(array $preferredNames = [], ?int $fallbackIndex = null): ?string
    {
        $availableImages = $this->availableDownloadImages();

        if ($availableImages === []) {
            return null;
        }

        $imagesByName = collect($availableImages)->mapWithKeys(fn (string $path) => [
            strtolower(basename($path)) => $path,
        ]);

        foreach ($preferredNames as $name) {
            $resolved = $imagesByName->get(strtolower($name));
            if ($resolved) {
                return $resolved;
            }
        }

        if ($fallbackIndex !== null && isset($availableImages[$fallbackIndex])) {
            return $availableImages[$fallbackIndex];
        }

        return $availableImages[0];
    }

    private function availableDownloadImages(): array
    {
        if ($this->downloadImagesCache !== null) {
            return $this->downloadImagesCache;
        }

        $downloadsDirectory = $this->downloadsDirectory();

        if (!File::isDirectory($downloadsDirectory)) {
            return $this->downloadImagesCache = [];
        }

        $this->downloadImagesCache = collect(File::files($downloadsDirectory))
            ->filter(function (\SplFileInfo $file): bool {
                return in_array(strtolower($file->getExtension()), ['jpg', 'jpeg', 'png'], true);
            })
            ->sortBy(fn (\SplFileInfo $file) => strtolower($file->getFilename()))
            ->map(fn (\SplFileInfo $file) => $file->getPathname())
            ->values()
            ->all();

        return $this->downloadImagesCache;
    }

    private function downloadsDirectory(): string
    {
        $userProfile = (string) env('USERPROFILE', '');

        if ($userProfile === '') {
            $userProfile = (string) getenv('USERPROFILE');
        }

        return rtrim($userProfile, '\\/') . DIRECTORY_SEPARATOR . 'Downloads';
    }
}
