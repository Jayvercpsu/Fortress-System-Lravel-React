<?php
namespace App\Http\Controllers;

use App\Http\Requests\Users\StoreUserRequest;
use App\Http\Requests\Users\UpdateUserRequest;
use App\Models\User;
use App\Services\UserService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class UserController extends Controller
{
    public function __construct(
        private readonly UserService $userService
    ) {
    }

    public function index(Request $request)
    {
        return Inertia::render('HeadAdmin/Users/Index', [
            ...$this->userService->indexPayload($request),
        ]);
    }

    public function create()
    {
        return Inertia::render('HeadAdmin/Users/Create', [
            'user' => $this->userService->userFormPayload(new User()),
        ]);
    }

    public function edit(User $user)
    {
        if (in_array($user->role, [User::ROLE_HEAD_ADMIN, User::ROLE_CLIENT], true)) abort(403);

        $loadedUser = $this->userService->loadUserForEdit($user);

        return Inertia::render('HeadAdmin/Users/Edit', [
            'user' => $this->userService->userFormPayload($loadedUser),
        ]);
    }

    public function store(StoreUserRequest $request)
    {
        $this->userService->createUser($request->validated());

        return redirect()->route('users.index')->with('success', __('messages.users.created'));
    }

    public function update(UpdateUserRequest $request, User $user)
    {
        if (in_array($user->role, [User::ROLE_HEAD_ADMIN, User::ROLE_CLIENT], true)) abort(403);

        $this->userService->updateUser($user, $request->validated());

        return redirect()
            ->route('users.index', $this->userService->tableQueryParams($request))
            ->with('success', __('messages.users.updated'));
    }

    public function destroy(Request $request, User $user)
    {
        if (in_array($user->role, [User::ROLE_HEAD_ADMIN, User::ROLE_CLIENT], true)) abort(403);

        $this->userService->deleteUser($user);

        return redirect()
            ->route('users.index', $this->userService->tableQueryParams($request))
            ->with('success', __('messages.users.deleted'));
    }
}
