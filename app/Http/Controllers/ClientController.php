<?php

namespace App\Http\Controllers;

use App\Http\Requests\Clients\StoreClientRequest;
use App\Http\Requests\Clients\UpdateClientRequest;
use App\Models\User;
use App\Services\ClientService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ClientController extends Controller
{
    public function __construct(
        private readonly ClientService $clientService
    ) {
    }

    public function index(Request $request)
    {
        return Inertia::render('HeadAdmin/Clients/Index', [
            ...$this->clientService->indexPayload($request),
        ]);
    }

    public function store(StoreClientRequest $request)
    {
        $this->clientService->createClient($request->validated());

        return redirect()
            ->route('clients.index')
            ->with('success', __('messages.clients.created'));
    }

    public function update(UpdateClientRequest $request, User $user)
    {
        abort_unless($user->role === User::ROLE_CLIENT, 403);

        $this->clientService->updateClient($user, $request->validated());

        return redirect()
            ->route('clients.index', $this->clientService->tableQueryParams($request))
            ->with('success', __('messages.clients.updated'));
    }

    public function destroy(Request $request, User $user)
    {
        abort_unless($user->role === User::ROLE_CLIENT, 403);

        $this->clientService->deleteClient($user);

        return redirect()
            ->route('clients.index', $this->clientService->tableQueryParams($request))
            ->with('success', __('messages.clients.deleted'));
    }
}
