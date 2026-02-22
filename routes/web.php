<?php
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\BuildController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DesignController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\MaterialController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\ForemansController;
use App\Http\Controllers\PayrollController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\ProjectFileController;
use App\Http\Controllers\ProjectUpdateController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn() => redirect()->route('login'));

Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

Route::middleware(['auth', 'role:head_admin'])->group(function () {
    Route::get('/head-admin', [DashboardController::class, 'headAdmin'])->name('head_admin.dashboard');
    Route::get('/users', [UserController::class, 'index'])->name('users.index');
    Route::get('/users/create', [UserController::class, 'create'])->name('users.create');
    Route::post('/users', [UserController::class, 'store'])->name('users.store');
    Route::delete('/users/{user}', [UserController::class, 'destroy'])->name('users.destroy');
});

Route::middleware(['auth', 'role:admin'])->group(function () {
    Route::get('/admin', [DashboardController::class, 'admin'])->name('admin.dashboard');
});

Route::middleware(['auth', 'role:hr'])->group(function () {
    Route::get('/hr', [DashboardController::class, 'hr'])->name('hr.dashboard');
    Route::get('/payroll', [PayrollController::class, 'index'])->name('payroll.index');
    Route::post('/payroll', [PayrollController::class, 'store'])->name('payroll.store');
    Route::patch('/payroll/{payroll}/status', [PayrollController::class, 'updateStatus'])->name('payroll.status');
});

Route::middleware(['auth', 'role:foreman'])->group(function () {
    Route::get('/foreman', [DashboardController::class, 'foreman'])->name('foreman.dashboard');
    Route::post('/foreman/submit-all', [ForemansController::class, 'submitAll'])->name('foreman.submit_all');
    Route::post('/foreman/progress-photo', [ForemansController::class, 'storeProgressPhoto'])->name('foreman.photo');
});

Route::middleware(['auth', 'role:head_admin,admin'])->group(function () {
    Route::get('/projects', [ProjectController::class, 'index'])->name('projects.index');
    Route::get('/projects/create', [ProjectController::class, 'create'])->name('projects.create');
    Route::post('/projects', [ProjectController::class, 'store'])->name('projects.store');
    Route::get('/projects/{project}/edit', [ProjectController::class, 'edit'])->name('projects.edit');
    Route::patch('/projects/{project}', [ProjectController::class, 'update'])->name('projects.update');

    Route::get('/projects/{project}/design', [DesignController::class, 'show'])->name('design.show');
    Route::patch('/projects/{project}/design', [DesignController::class, 'update'])->name('design.update');
    Route::get('/projects/{project}/build', [BuildController::class, 'show'])->name('build.show');
    Route::patch('/projects/{project}/build', [BuildController::class, 'update'])->name('build.update');

    Route::get('/projects/{project}/expenses', [ExpenseController::class, 'index'])->name('expenses.index');
    Route::post('/projects/{project}/expenses', [ExpenseController::class, 'store'])->name('expenses.store');
    Route::patch('/expenses/{expense}', [ExpenseController::class, 'update'])->name('expenses.update');
    Route::delete('/expenses/{expense}', [ExpenseController::class, 'destroy'])->name('expenses.destroy');

    Route::get('/materials', [MaterialController::class, 'index'])->name('materials.index');
    Route::post('/materials', [MaterialController::class, 'store'])->name('materials.store');
    Route::patch('/materials/{material}', [MaterialController::class, 'update'])->name('materials.update');
    Route::delete('/materials/{material}', [MaterialController::class, 'destroy'])->name('materials.destroy');

    Route::get('/projects/{project}/files', [ProjectFileController::class, 'index'])->name('project-files.index');
    Route::post('/projects/{project}/files', [ProjectFileController::class, 'store'])->name('project-files.store');
    Route::delete('/project-files/{projectFile}', [ProjectFileController::class, 'destroy'])->name('project-files.destroy');

    Route::get('/projects/{project}/updates', [ProjectUpdateController::class, 'index'])->name('project-updates.index');
    Route::post('/projects/{project}/updates', [ProjectUpdateController::class, 'store'])->name('project-updates.store');

    Route::get('/projects/{project}', [ProjectController::class, 'show'])->name('projects.show');
});

Route::middleware(['auth', 'role:head_admin,hr'])->group(function () {
    Route::patch('/projects/{project}/financials', [ProjectController::class, 'updateFinancials'])->name('projects.financials.update');
});
