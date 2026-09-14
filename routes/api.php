<?php

use App\Http\Controllers\Api\ForemanAuthController;
use App\Http\Controllers\Api\ForemanSubmissionController;
use App\Http\Controllers\Api\ProjectManagerApiController;
use App\Http\Controllers\Api\ProjectManagerAuthController;
use Illuminate\Support\Facades\Route;

Route::post('/foreman/login', [ForemanAuthController::class, 'login'])->name('api.foreman.login');
Route::post('/project-manager/login', [ProjectManagerAuthController::class, 'login'])->name('api.pm.login');
Route::get('/server-time', [ForemanAuthController::class, 'serverTime'])->name('api.server_time');

Route::middleware('foreman.api')->group(function () {
    Route::get('/foreman/me', [ForemanAuthController::class, 'me'])->name('api.foreman.me');
    Route::get('/foreman/stats', [ForemanAuthController::class, 'stats'])->name('api.foreman.stats');
    Route::get('/foreman/projects', [ForemanAuthController::class, 'projects'])->name('api.foreman.projects');
    Route::get('/foreman/projects/{project}/jotform', [ForemanAuthController::class, 'jotform'])->name('api.foreman.jotform');
    Route::post('/foreman/projects/{project}/ai-attendance/scan', [ForemanAuthController::class, 'scanAiAttendance'])->name('api.foreman.ai_scan');
    Route::post('/foreman/projects/{project}/submit-all', [ForemanSubmissionController::class, 'submitAll'])->name('api.foreman.submit_all');
    Route::delete('/foreman/deliveries/{deliveryConfirmation}', [ForemanSubmissionController::class, 'destroyDelivery'])->name('api.foreman.delivery.delete');
    Route::delete('/foreman/materials/{materialRequest}', [ForemanSubmissionController::class, 'destroyMaterial'])->name('api.foreman.material.delete');
    Route::delete('/foreman/photos/{progressPhoto}', [ForemanSubmissionController::class, 'destroyPhoto'])->name('api.foreman.photo.delete');
    Route::delete('/foreman/issues/{issueReport}', [ForemanSubmissionController::class, 'destroyIssue'])->name('api.foreman.issue.delete');
    Route::delete('/foreman/scope-photos/{scopePhoto}', [ForemanSubmissionController::class, 'destroyScopePhoto'])->name('api.foreman.scope_photo.delete');
    Route::post('/foreman/ai-attendance/records/{record}/confirm', [ForemanAuthController::class, 'confirmAiRecord'])->name('api.foreman.ai_confirm');
    Route::post('/foreman/ai-attendance/records/{record}/reject', [ForemanAuthController::class, 'rejectAiRecord'])->name('api.foreman.ai_reject');
    Route::put('/foreman/ai-attendance/records/{record}/edit', [ForemanAuthController::class, 'editAiRecord'])->name('api.foreman.ai_edit');
    Route::get('/foreman/settings', [ForemanAuthController::class, 'settings'])->name('api.foreman.settings');
    Route::put('/foreman/settings', [ForemanAuthController::class, 'updateSettings'])->name('api.foreman.settings.update');
    Route::post('/foreman/settings/photo', [ForemanAuthController::class, 'updatePhoto'])->name('api.foreman.settings.photo');
    Route::post('/foreman/logout', [ForemanAuthController::class, 'logout'])->name('api.foreman.logout');
});

Route::middleware('pm.api')->group(function () {
    Route::get('/project-manager/me', [ProjectManagerAuthController::class, 'me'])->name('api.pm.me');
    Route::get('/project-manager/projects', [ProjectManagerAuthController::class, 'projects'])->name('api.pm.projects');
    Route::get('/project-manager/dashboard', [ProjectManagerApiController::class, 'dashboard'])->name('api.pm.dashboard');
    Route::get('/project-manager/accomplishments', [ProjectManagerApiController::class, 'accomplishments'])->name('api.pm.accomplishments');
    Route::post('/project-manager/accomplishments', [ProjectManagerApiController::class, 'storeAccomplishments'])->name('api.pm.accomplishments.store');
    Route::get('/project-manager/attendance', [ProjectManagerApiController::class, 'attendance'])->name('api.pm.attendance');
    Route::get('/project-manager/payroll', [ProjectManagerApiController::class, 'payroll'])->name('api.pm.payroll');
    Route::get('/project-manager/projects/{project}', [ProjectManagerApiController::class, 'project'])->name('api.pm.project');
    Route::get('/project-manager/settings', [ProjectManagerAuthController::class, 'settings'])->name('api.pm.settings');
    Route::put('/project-manager/settings', [ProjectManagerAuthController::class, 'updateSettings'])->name('api.pm.settings.update');
    Route::post('/project-manager/settings/photo', [ProjectManagerAuthController::class, 'updatePhoto'])->name('api.pm.settings.photo');
    Route::post('/project-manager/logout', [ProjectManagerAuthController::class, 'logout'])->name('api.pm.logout');
});
