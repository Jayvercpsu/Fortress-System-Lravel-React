<?php

namespace App\Support;

final class DesignComputation
{
    private const MILESTONE_BASIS = [
        [
            'key' => 'second_page_title_intro_floorplan',
            'label' => 'Second page title / intro / floorplan',
            'percent' => 10,
        ],
        [
            'key' => 'first_dp',
            'label' => 'First, DP 50%',
            'percent' => 5,
        ],
        [
            'key' => 'floor_plan_requirements',
            'label' => 'Floor plan requirements',
            'percent' => 10,
        ],
        [
            'key' => 'floor_plan',
            'label' => 'Floor plan',
            'percent' => 10,
        ],
        [
            'key' => 'extension_design',
            'label' => 'Extension design',
            'percent' => 10,
        ],
        [
            'key' => 'interior_design',
            'label' => 'Interior design',
            'percent' => 10,
        ],
        [
            'key' => 'rendering_walkthrough',
            'label' => '3D rendering / walkthrough',
            'percent' => 10,
        ],
        [
            'key' => 'cad',
            'label' => 'CAD',
            'percent' => 10,
        ],
        [
            'key' => 'initial_printing',
            'label' => 'Initial 10K for printing (blueprint press)',
            'percent' => 5,
        ],
        [
            'key' => 'sign_and_sealed',
            'label' => 'Sign & sealed',
            'percent' => 10,
        ],
        [
            'key' => 'turnover_final_payment',
            'label' => 'Turnover / final payment',
            'percent' => 10,
        ],
    ];

    public static function milestoneBasis(): array
    {
        return self::MILESTONE_BASIS;
    }

    public static function totalBasisPercent(): int
    {
        return (int) array_sum(array_column(self::MILESTONE_BASIS, 'percent'));
    }

    public static function computeCollectionPercent(float $designContractAmount, float $totalReceived): float
    {
        if ($designContractAmount <= 0 || $totalReceived <= 0) {
            return 0.0;
        }

        $ratio = ($totalReceived / $designContractAmount) * 100;

        return max(0.0, min(100.0, $ratio));
    }

    public static function computeProgress(float $designContractAmount, float $totalReceived, string $clientApprovalStatus): int
    {
        if (strtolower(trim($clientApprovalStatus)) === 'approved') {
            return self::totalBasisPercent();
        }

        $collectionPercent = self::computeCollectionPercent($designContractAmount, $totalReceived);
        if ($collectionPercent <= 0) {
            return 0;
        }

        $progress = 0;
        $cumulativePercent = 0;
        foreach (self::MILESTONE_BASIS as $milestone) {
            $cumulativePercent += (int) ($milestone['percent'] ?? 0);
            if ($collectionPercent + 0.000001 >= $cumulativePercent) {
                $progress = $cumulativePercent;
                continue;
            }

            break;
        }

        return (int) max(0, min(self::totalBasisPercent(), $progress));
    }

    public static function milestoneBreakdown(float $designContractAmount): array
    {
        $contractAmount = max(0.0, $designContractAmount);
        $cumulativePercent = 0;
        $cumulativeAmount = 0.0;

        return array_map(function (array $milestone) use ($contractAmount, &$cumulativePercent, &$cumulativeAmount): array {
            $percent = (int) ($milestone['percent'] ?? 0);
            $amount = round(($contractAmount * $percent) / 100, 2);
            $cumulativePercent += $percent;
            $cumulativeAmount = round($cumulativeAmount + $amount, 2);

            return [
                'key' => (string) ($milestone['key'] ?? ''),
                'label' => (string) ($milestone['label'] ?? ''),
                'percent' => $percent,
                'amount' => $amount,
                'cumulative_percent' => $cumulativePercent,
                'cumulative_amount' => $cumulativeAmount,
            ];
        }, self::MILESTONE_BASIS);
    }
}
