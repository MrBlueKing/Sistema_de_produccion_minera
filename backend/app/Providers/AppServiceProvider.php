<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use App\Models\Dispatch\Dumpada;
use App\Observers\DumpadaObserver;

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
        Dumpada::observe(DumpadaObserver::class);
    }
}
