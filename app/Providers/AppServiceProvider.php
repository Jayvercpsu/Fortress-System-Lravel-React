<?php

namespace App\Providers;

use App\Models\Project;
use App\Models\WeeklyAccomplishment;
use App\Observers\ProjectObserver;
use App\Observers\WeeklyAccomplishmentObserver;
use App\Repositories\ClientRepository;
use App\Repositories\ClientPortalRepository;
use App\Repositories\BuildRepository;
use App\Repositories\AttendanceRepository;
use App\Repositories\DashboardRepository;
use App\Repositories\DeliveryConfirmationRepository;
use App\Repositories\ForemanWorkerRepository;
use App\Repositories\ForemanProgressRepository;
use App\Repositories\IssueReportRepository;
use App\Repositories\KpiRepository;
use App\Repositories\MaterialRequestRepository;
use App\Repositories\MonitoringRepository;
use App\Repositories\PayrollRepository;
use App\Repositories\ProgressPhotoRepository;
use App\Repositories\ReportRepository;
use App\Repositories\MonitoringBoardRepository;
use App\Repositories\Contracts\ClientRepositoryInterface;
use App\Repositories\Contracts\ClientPortalRepositoryInterface;
use App\Repositories\Contracts\BuildRepositoryInterface;
use App\Repositories\Contracts\AttendanceRepositoryInterface;
use App\Repositories\Contracts\DashboardRepositoryInterface;
use App\Repositories\Contracts\DeliveryConfirmationRepositoryInterface;
use App\Repositories\Contracts\ForemanWorkerRepositoryInterface;
use App\Repositories\Contracts\ForemanProgressRepositoryInterface;
use App\Repositories\Contracts\IssueReportRepositoryInterface;
use App\Repositories\Contracts\KpiRepositoryInterface;
use App\Repositories\Contracts\MaterialRequestRepositoryInterface;
use App\Repositories\Contracts\MonitoringRepositoryInterface;
use App\Repositories\Contracts\PayrollRepositoryInterface;
use App\Repositories\Contracts\MonitoringBoardRepositoryInterface;
use App\Repositories\Contracts\ProgressPhotoRepositoryInterface;
use App\Repositories\Contracts\ReportRepositoryInterface;
use App\Repositories\Contracts\ExpenseRepositoryInterface;
use App\Repositories\Contracts\MaterialRepositoryInterface;
use App\Repositories\Contracts\PaymentRepositoryInterface;
use App\Repositories\Contracts\DesignRepositoryInterface;
use App\Repositories\Contracts\ProjectFileRepositoryInterface;
use App\Repositories\Contracts\ProjectRepositoryInterface;
use App\Repositories\Contracts\ProjectUpdateRepositoryInterface;
use App\Repositories\Contracts\SettingsRepositoryInterface;
use App\Repositories\Contracts\ScopePhotoRepositoryInterface;
use App\Repositories\Contracts\StorageProxyRepositoryInterface;
use App\Repositories\Contracts\UserRepositoryInterface;
use App\Repositories\Contracts\WeeklyAccomplishmentRepositoryInterface;
use App\Repositories\StorageProxyRepository;
use App\Repositories\ExpenseRepository;
use App\Repositories\PaymentRepository;
use App\Repositories\DesignRepository;
use App\Repositories\MaterialRepository;
use App\Repositories\ProjectFileRepository;
use App\Repositories\ProjectRepository;
use App\Repositories\ProjectUpdateRepository;
use App\Repositories\SettingsRepository;
use App\Repositories\ScopePhotoRepository;
use App\Repositories\UserRepository;
use App\Repositories\WeeklyAccomplishmentRepository;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Schema;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(SettingsRepositoryInterface::class, SettingsRepository::class);
        $this->app->bind(UserRepositoryInterface::class, UserRepository::class);
        $this->app->bind(ClientRepositoryInterface::class, ClientRepository::class);
        $this->app->bind(ClientPortalRepositoryInterface::class, ClientPortalRepository::class);
        $this->app->bind(AttendanceRepositoryInterface::class, AttendanceRepository::class);
        $this->app->bind(DashboardRepositoryInterface::class, DashboardRepository::class);
        $this->app->bind(BuildRepositoryInterface::class, BuildRepository::class);
        $this->app->bind(DeliveryConfirmationRepositoryInterface::class, DeliveryConfirmationRepository::class);
        $this->app->bind(ForemanWorkerRepositoryInterface::class, ForemanWorkerRepository::class);
        $this->app->bind(ForemanProgressRepositoryInterface::class, ForemanProgressRepository::class);
        $this->app->bind(IssueReportRepositoryInterface::class, IssueReportRepository::class);
        $this->app->bind(KpiRepositoryInterface::class, KpiRepository::class);
        $this->app->bind(MaterialRequestRepositoryInterface::class, MaterialRequestRepository::class);
        $this->app->bind(MonitoringRepositoryInterface::class, MonitoringRepository::class);
        $this->app->bind(PayrollRepositoryInterface::class, PayrollRepository::class);
        $this->app->bind(MonitoringBoardRepositoryInterface::class, MonitoringBoardRepository::class);
        $this->app->bind(ProgressPhotoRepositoryInterface::class, ProgressPhotoRepository::class);
        $this->app->bind(ReportRepositoryInterface::class, ReportRepository::class);
        $this->app->bind(MaterialRepositoryInterface::class, MaterialRepository::class);
        $this->app->bind(ExpenseRepositoryInterface::class, ExpenseRepository::class);
        $this->app->bind(PaymentRepositoryInterface::class, PaymentRepository::class);
        $this->app->bind(DesignRepositoryInterface::class, DesignRepository::class);
        $this->app->bind(ProjectRepositoryInterface::class, ProjectRepository::class);
        $this->app->bind(ProjectUpdateRepositoryInterface::class, ProjectUpdateRepository::class);
        $this->app->bind(ProjectFileRepositoryInterface::class, ProjectFileRepository::class);
        $this->app->bind(ScopePhotoRepositoryInterface::class, ScopePhotoRepository::class);
        $this->app->bind(StorageProxyRepositoryInterface::class, StorageProxyRepository::class);
        $this->app->bind(WeeklyAccomplishmentRepositoryInterface::class, WeeklyAccomplishmentRepository::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Schema::defaultStringLength(191);
        Project::observe(ProjectObserver::class);
        WeeklyAccomplishment::observe(WeeklyAccomplishmentObserver::class);
    }
}
