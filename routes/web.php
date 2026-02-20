<?php
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\ForemansController;
use App\Http\Controllers\PayrollController;
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