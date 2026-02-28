<?php

namespace App\Providers;

use App\Models\Project;
use App\Models\WeeklyAccomplishment;
use App\Observers\ProjectObserver;
use App\Observers\WeeklyAccomplishmentObserver;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Schema;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
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
