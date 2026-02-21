<?php

namespace App\Http\Controllers;

use App\Models\BuildProject;
use App\Models\Expense;
use Illuminate\Http\Request;
use Inertia\Inertia;

class BuildController extends Controller
{
    public function show(Request $request, string $project)
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);

        $build = BuildProject::firstOrCreate(
            ['project_id' => $project],
            [
                'construction_contract' => 0,
                'total_client_payment' => 0,
                'materials_cost' => 0,
                'labor_cost' => 0,
                'equipment_cost' => 0,
            ]
        );

        $totalExpenses = (float) $build->materials_cost + (float) $build->labor_cost + (float) $build->equipment_cost;
        $constructionContract = (float) $build->construction_contract;
        $totalClientPayment = (float) $build->total_client_payment;

        $payload = [
            'project_id' => $build->project_id,
            'construction_contract' => $constructionContract,
            'total_client_payment' => $totalClientPayment,
            'materials_cost' => (float) $build->materials_cost,
            'labor_cost' => (float) $build->labor_cost,
            'equipment_cost' => (float) $build->equipment_cost,
            'total_expenses' => $totalExpenses,
            'remaining_budget' => $totalClientPayment - $totalExpenses,
            'budget_vs_actual' => $constructionContract - $totalExpenses,
            'payment_progress' => $constructionContract > 0
                ? round(($totalClientPayment / $constructionContract) * 100, 2)
                : 0,
        ];

        $expenses = Expense::query()
            ->where('project_id', $project)
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->get(['id', 'project_id', 'category', 'amount', 'note', 'date'])
            ->map(fn (Expense $expense) => [
                'id' => $expense->id,
                'project_id' => $expense->project_id,
                'category' => $expense->category,
                'amount' => (float) $expense->amount,
                'note' => $expense->note,
                'date' => optional($expense->date)->toDateString(),
            ])
            ->values();

        $expenseTotal = (float) $expenses->sum('amount');

        $page = $request->user()->role === 'head_admin'
            ? 'HeadAdmin/Build/Show'
            : 'Admin/Build/Show';

        return Inertia::render($page, [
            'projectId' => (string) $project,
            'build' => $payload,
            'expenses' => $expenses,
            'expenseTotal' => $expenseTotal,
            'remainingIncome' => $constructionContract - $expenseTotal,
        ]);
    }

    public function update(Request $request, string $project)
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);

        $validated = $request->validate([
            'construction_contract' => 'required|numeric|min:0',
            'total_client_payment' => 'required|numeric|min:0',
            'materials_cost' => 'required|numeric|min:0',
            'labor_cost' => 'required|numeric|min:0',
            'equipment_cost' => 'required|numeric|min:0',
        ]);

        BuildProject::updateOrCreate(
            ['project_id' => $project],
            $validated
        );

        return redirect()
            ->route('build.show', ['project' => $project])
            ->with('success', 'Build tracker updated.');
    }
}
