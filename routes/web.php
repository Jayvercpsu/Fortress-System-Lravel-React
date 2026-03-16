<?php
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\AttendanceController;
use App\Http\Controllers\BuildController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\ClientPortalController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DesignController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\ForemanWorkerController;
use App\Http\Controllers\ForemansController;
use App\Http\Controllers\KpiController;
use App\Http\Controllers\MaterialRequestController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\WeeklyAccomplishmentController;
use App\Http\Controllers\PayrollController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\ProjectFileController;
use App\Http\Controllers\ProgressPhotoController;
use App\Http\Controllers\DeliveryConfirmationController;
use App\Http\Controllers\IssueReportController;
use App\Http\Controllers\PublicProgressController;
use App\Http\Controllers\ReportsController;
use App\Http\Controllers\ScopePhotoController;
use App\Http\Controllers\StorageProxyController;
use App\Http\Controllers\MonitoringController;
use App\Http\Controllers\MonitoringBoardController;
use App\Http\Controllers\ProjectUpdateController;
use App\Http\Controllers\SettingsController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn() => redirect()->route('login'));
Route::get('/login', fn() => redirect()->route('login'));
Route::get('/storage/{path}', [StorageProxyController::class, 'show'])
    ->where('path', '.*')
    ->name('storage.proxy');

Route::get('/admin/login', [AuthController::class, 'showLogin'])->name('login');
Route::post('/admin/login', [AuthController::class, 'login']);
Route::get('/client/login', [AuthController::class, 'showClientLogin'])->name('client.login');
Route::post('/client/login', [AuthController::class, 'clientLogin'])->name('client.login.submit');
Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
Route::get('/progress-submit/{token}', [PublicProgressController::class, 'show'])->name('public.progress-submit.show');
Route::get('/progress-receipt/{token}', [PublicProgressController::class, 'receipt'])->name('public.progress-receipt');
Route::get('/progress-receipt/{token}/export', [PublicProgressController::class, 'exportReceipt'])->name('public.progress-receipt.export');
Route::post('/progress-submit/{token}', [PublicProgressController::class, 'store'])->name('public.progress-submit.store');
Route::post('/progress-submit/{token}/submit-all', [PublicProgressController::class, 'storeAll'])->name('public.progress-submit.submit_all');
Route::post('/progress-submit/{token}/attendance', [PublicProgressController::class, 'storeAttendance'])->name('public.progress-submit.attendance');
Route::post('/progress-submit/{token}/delivery', [PublicProgressController::class, 'storeDelivery'])->name('public.progress-submit.delivery');
Route::post('/progress-submit/{token}/material-request', [PublicProgressController::class, 'storeMaterialRequest'])->name('public.progress-submit.material');
Route::post('/progress-submit/{token}/weekly-progress', [PublicProgressController::class, 'storeWeeklyProgress'])->name('public.progress-submit.weekly');
Route::post('/progress-submit/{token}/photo', [PublicProgressController::class, 'storePhoto'])->name('public.progress-submit.photo');
Route::post('/progress-submit/{token}/issue-report', [PublicProgressController::class, 'storeIssueReport'])->name('public.progress-submit.issue');

Route::middleware(['auth', 'role:head_admin,admin,hr,foreman'])->group(function () {
    Route::get('/settings', [SettingsController::class, 'index'])->name('settings.index');
    Route::post('/settings', [SettingsController::class, 'update'])->name('settings.update');
});

Route::middleware(['auth', 'role:head_admin,admin,hr'])->group(function () {
    Route::get('/kpi', [KpiController::class, 'index'])->name('kpi.index');
    Route::get('/kpi/print', [KpiController::class, 'print'])->name('kpi.print');
    Route::get('/kpi/export', [KpiController::class, 'export'])->name('kpi.export');
});

Route::middleware(['auth', 'role:head_admin'])->group(function () {
    Route::get('/head-admin', [DashboardController::class, 'headAdmin'])->name('head_admin.dashboard');
    Route::delete('/projects/{project}', [ProjectController::class, 'destroy'])->name('projects.destroy');
    Route::get('/users', [UserController::class, 'index'])->name('users.index');
    Route::get('/users/create', [UserController::class, 'create'])->name('users.create');
    Route::get('/users/{user}/edit', [UserController::class, 'edit'])->name('users.edit');
    Route::post('/users', [UserController::class, 'store'])->name('users.store');
    Route::patch('/users/{user}', [UserController::class, 'update'])->name('users.update');
    Route::delete('/users/{user}', [UserController::class, 'destroy'])->name('users.destroy');
    Route::get('/clients', [ClientController::class, 'index'])->name('clients.index');
    Route::post('/clients', [ClientController::class, 'store'])->name('clients.store');
    Route::patch('/clients/{user}', [ClientController::class, 'update'])->name('clients.update');
    Route::delete('/clients/{user}', [ClientController::class, 'destroy'])->name('clients.destroy');
});

Route::middleware(['auth', 'role:admin'])->group(function () {
    Route::get('/admin', [DashboardController::class, 'admin'])->name('admin.dashboard');
});

Route::middleware(['auth', 'role:head_admin,admin,hr'])->group(function () {
    Route::get('/hr', [DashboardController::class, 'hr'])->name('hr.dashboard');
    Route::get('/payroll/run', [PayrollController::class, 'run'])->name('payroll.run');
    Route::post('/payroll/run/generate', [PayrollController::class, 'generateFromAttendance'])->name('payroll.run.generate');
    Route::post('/payroll/run/mark-paid', [PayrollController::class, 'markPaid'])->name('payroll.run.mark_paid');
    Route::get('/payroll/export', [PayrollController::class, 'export'])->name('payroll.export');
    Route::post('/payroll/{payroll}/deductions', [PayrollController::class, 'addDeduction'])->name('payroll.deductions.store');
    Route::patch('/payroll-deductions/{payrollDeduction}', [PayrollController::class, 'updateDeduction'])->name('payroll.deductions.update');
    Route::delete('/payroll-deductions/{payrollDeduction}', [PayrollController::class, 'destroyDeduction'])->name('payroll.deductions.destroy');
    Route::get('/payroll/worker-rates', [PayrollController::class, 'workerRates'])->name('payroll.worker_rates');
    Route::patch('/payroll/worker-rates/{worker}', [PayrollController::class, 'updateWorkerRate'])->name('payroll.worker_rates.update');
    Route::patch('/payroll/foreman-rates/{user}', [PayrollController::class, 'updateForemanRate'])->name('payroll.foreman_rates.update');
    Route::get('/payroll', [PayrollController::class, 'index'])->name('payroll.index');
    Route::post('/payroll', [PayrollController::class, 'store'])->name('payroll.store');
    Route::patch('/payroll/{payroll}', [PayrollController::class, 'update'])->name('payroll.update');
    Route::patch('/payroll/{payroll}/status', [PayrollController::class, 'updateStatus'])->name('payroll.status');
    Route::get('/projects/{project}/payments', [PaymentController::class, 'index'])->name('payments.index');
    Route::post('/projects/{project}/payments', [PaymentController::class, 'store'])->name('payments.store');
    Route::delete('/payments/{payment}', [PaymentController::class, 'destroy'])->name('payments.destroy');
});

Route::middleware(['auth', 'role:foreman'])->group(function () {
    Route::get('/foreman', [DashboardController::class, 'foreman'])->name('foreman.dashboard');
    Route::get('/foreman/submissions', [DashboardController::class, 'foremanSubmissions'])->name('foreman.submissions');
    Route::get('/foreman/workers', [ForemanWorkerController::class, 'index'])->name('foreman.workers.index');
    Route::post('/foreman/workers', [ForemanWorkerController::class, 'store'])->name('foreman.workers.store');
    Route::patch('/foreman/workers/{worker}', [ForemanWorkerController::class, 'update'])->name('foreman.workers.update');
    Route::delete('/foreman/workers/{worker}', [ForemanWorkerController::class, 'destroy'])->name('foreman.workers.destroy');

    Route::get('/foreman/attendance', [ForemansController::class, 'attendanceIndex'])->name('foreman.attendance.index');
    Route::post('/foreman/attendance', [ForemansController::class, 'storeAttendance'])->name('foreman.attendance.store');
    Route::patch('/foreman/attendance/{attendance}', [ForemansController::class, 'updateAttendance'])->name('foreman.attendance.update');
    Route::post('/foreman/attendance/time-in', [ForemansController::class, 'timeInAttendance'])->name('foreman.attendance.time_in');
    Route::post('/foreman/attendance/time-out', [ForemansController::class, 'timeOutAttendance'])->name('foreman.attendance.time_out');
    Route::post('/foreman/submit-all', [ForemansController::class, 'submitAll'])->name('foreman.submit_all');
    Route::post('/foreman/progress-photo', [ForemansController::class, 'storeProgressPhoto'])->name('foreman.photo');
});

Route::middleware(['auth', 'role:client'])->group(function () {
    Route::get('/client', [ClientPortalController::class, 'index'])->name('client.dashboard');
});

Route::middleware(['auth', 'role:head_admin,admin'])->group(function () {
    Route::get('/monitoring-board', [MonitoringBoardController::class, 'index'])->name('monitoring-board.index');
    Route::post('/monitoring-board', [MonitoringBoardController::class, 'store'])->name('monitoring-board.store');
    Route::patch('/monitoring-board/{item}', [MonitoringBoardController::class, 'update'])->name('monitoring-board.update');
    Route::delete('/monitoring-board/{item}', [MonitoringBoardController::class, 'destroy'])->name('monitoring-board.destroy');
    Route::post('/monitoring-board/{item}/files', [MonitoringBoardController::class, 'storeFile'])->name('monitoring-board.files.store');
    Route::delete('/monitoring-board-files/{file}', [MonitoringBoardController::class, 'destroyFile'])->name('monitoring-board.files.destroy');

    Route::get('/attendance/summary', [AttendanceController::class, 'summary'])->name('attendance.summary');
    Route::get('/attendance', [AttendanceController::class, 'index'])->name('attendance.index');
    Route::get('/reports', [ReportsController::class, 'index'])->name('reports.index');
    Route::get('/weekly-accomplishments', [WeeklyAccomplishmentController::class, 'index'])->name('weekly-accomplishments.index');
    Route::get('/materials', [MaterialRequestController::class, 'index'])->name('materials.index');
    Route::patch('/materials/{materialRequest}/status', [MaterialRequestController::class, 'updateStatus'])->name('materials.status');
    Route::get('/delivery', [DeliveryConfirmationController::class, 'index'])->name('delivery.index');
    Route::patch('/issues/{issueReport}/status', [IssueReportController::class, 'updateStatus'])->name('issues.status');
    Route::get('/issues', [IssueReportController::class, 'index'])->name('issues.index');

    Route::get('/projects', [ProjectController::class, 'index'])->name('projects.index');
    Route::get('/projects/create', [ProjectController::class, 'create'])->name('projects.create');
    Route::post('/projects', [ProjectController::class, 'store'])->name('projects.store');
    Route::get('/projects/{project}/edit', [ProjectController::class, 'edit'])->name('projects.edit');
    Route::patch('/projects/{project}/assigned-foremen', [ProjectController::class, 'updateAssignedForemen'])->name('projects.assigned_foremen.update');
    Route::patch('/projects/{project}/phase', [ProjectController::class, 'updatePhase'])->name('projects.phase.update');
    Route::patch('/projects/{project}/transfer-to-construction', [ProjectController::class, 'transferToConstruction'])->name('projects.transfer.construction');
    Route::patch('/projects/{project}/transfer-to-completed', [ProjectController::class, 'transferToCompleted'])->name('projects.transfer.completed');
    Route::patch('/projects/{project}', [ProjectController::class, 'update'])->name('projects.update');

    Route::get('/projects/{project}/design', [DesignController::class, 'show'])->name('design.show');
    Route::patch('/projects/{project}/design', [DesignController::class, 'update'])->name('design.update');
    Route::post('/projects/{project}/team', [ProjectController::class, 'storeTeamMember'])->name('projects.team.store');
    Route::delete('/project-team/{projectWorker}', [ProjectController::class, 'destroyTeamMember'])->name('projects.team.destroy');
    Route::get('/projects/{project}/build', [BuildController::class, 'show'])->name('build.show');
    Route::patch('/projects/{project}/build', [BuildController::class, 'update'])->name('build.update');
    Route::get('/projects/{project}/expenses', [ExpenseController::class, 'index'])->name('expenses.index');
    Route::post('/projects/{project}/expenses', [ExpenseController::class, 'store'])->name('expenses.store');
    Route::patch('/expenses/{expense}', [ExpenseController::class, 'update'])->name('expenses.update');
    Route::delete('/expenses/{expense}', [ExpenseController::class, 'destroy'])->name('expenses.destroy');

    Route::get('/projects/{project}/monitoring', [MonitoringController::class, 'show'])->name('monitoring.show');
    Route::post('/projects/{project}/scopes', [MonitoringController::class, 'store'])->name('scopes.store');
    Route::patch('/scopes/{scope}', [MonitoringController::class, 'update'])->name('scopes.update');
    Route::delete('/scopes/{scope}', [MonitoringController::class, 'destroy'])->name('scopes.destroy');
    Route::post('/scopes/{scope}/photos', [ScopePhotoController::class, 'store'])->name('scope-photos.store');
    Route::delete('/scope-photos/{photo}', [ScopePhotoController::class, 'destroy'])->name('scope-photos.destroy');
    Route::get('/progress-photos', [ProgressPhotoController::class, 'index'])->name('progress-photos.index');
    Route::get('/projects/{project}/files', [ProjectFileController::class, 'index'])->name('project-files.index');
    Route::post('/projects/{project}/files', [ProjectFileController::class, 'store'])->name('project-files.store');
    Route::delete('/project-files/{projectFile}', [ProjectFileController::class, 'destroy'])->name('project-files.destroy');
    Route::get('/projects/{project}/updates', [ProjectUpdateController::class, 'index'])->name('project-updates.index');
    Route::post('/projects/{project}/updates', [ProjectUpdateController::class, 'store'])->name('project-updates.store');
    Route::get('/projects/{project}/client-receipt', [ProjectController::class, 'projectReceipt'])->name('projects.client_receipt');
    Route::get('/projects/{project}', [ProjectController::class, 'show'])->name('projects.show');
});

Route::middleware(['auth', 'role:head_admin'])->group(function () {
});

Route::middleware(['auth', 'role:head_admin,admin,hr'])->group(function () {
    Route::get('/projects/{project}/financials', [ProjectController::class, 'editFinancials'])->name('projects.financials.edit');
    Route::patch('/projects/{project}/financials', [ProjectController::class, 'updateFinancials'])->name('projects.financials.update');
});
