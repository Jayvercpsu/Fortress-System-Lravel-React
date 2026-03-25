<?php

namespace App\Http\Controllers;

use App\Http\Requests\HrForemen\StoreHrForemanRequest;
use App\Http\Requests\HrForemen\UpdateHrForemanRequest;
use App\Models\User;
use App\Services\HrForemanService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class HrForemanController extends Controller
{
    public function __construct(
        private readonly HrForemanService $hrForemanService
    ) {
    }

    public function index(Request $request)
    {
        return Inertia::render('HR/Foremen/Index', $this->hrForemanService->indexPayload($request));
    }

    public function store(StoreHrForemanRequest $request)
    {
        $this->hrForemanService->createForeman($request->user(), $request->validated());

        return redirect()
            ->route('hr.foremen.index')
            ->with('success', __('messages.users.created'));
    }

    public function update(UpdateHrForemanRequest $request, User $foreman)
    {
        abort_unless($foreman->role === User::ROLE_FOREMAN, 404);

        $this->hrForemanService->updateForeman($request->user(), $foreman, $request->validated());

        return redirect()
            ->route('hr.foremen.index')
            ->with('success', __('messages.users.updated'));
    }

    public function destroy(Request $request, User $foreman)
    {
        abort_unless($foreman->role === User::ROLE_FOREMAN, 404);

        $this->hrForemanService->deleteForeman($request->user(), $foreman);

        return redirect()
            ->route('hr.foremen.index')
            ->with('success', __('messages.users.deleted'));
    }
}
