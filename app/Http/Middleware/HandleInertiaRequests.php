<?php
namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware {
    protected $rootView = 'app';

    public function share(Request $request): array {
        return array_merge(parent::share($request), [
            'auth' => [
                'user' => $request->user() ? [
                    'id'       => $request->user()->id,
                    'fullname' => $request->user()->fullname,
                    'email'    => $request->user()->email,
                    'role'     => $request->user()->role,
                    'profile_photo_path' => optional($request->user()->detail)->profile_photo_path,
                ] : null,
            ],
            'flash' => [
                'success' => $request->session()->pull('success'),
                'error'   => $request->session()->pull('error'),
            ],
        ]);
    }
}
