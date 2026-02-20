<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\WeeklyAccomplishment;
use App\Models\MaterialRequest;
use App\Models\IssueReport;
use App\Models\ProgressPhoto;
use App\Models\DeliveryConfirmation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ForemansController extends Controller
{
    public function storeAttendance(Request $request)
    {
        $request->validate([
            'entries' => 'required|array',
            'entries.*.worker_name' => 'required|string',
            'entries.*.worker_role' => 'required|string',
            'entries.*.date'        => 'required|date',
            'entries.*.hours'       => 'required|numeric|min:0',
        ]);

        foreach ($request->entries as $entry) {
            Attendance::create([
                'foreman_id'  => Auth::id(),
                'worker_name' => $entry['worker_name'],
                'worker_role' => $entry['worker_role'],
                'date'        => $entry['date'],
                'hours'       => $entry['hours'],
            ]);
        }

        return back()->with('success', 'Attendance submitted.');
    }

    public function storeAccomplishment(Request $request)
    {
        $request->validate([
            'week_start'   => 'required|date',
            'scopes'       => 'required|array',
            'scopes.*.scope_of_work'     => 'required|string',
            'scopes.*.percent_completed' => 'required|numeric|min:0|max:100',
        ]);

        foreach ($request->scopes as $scope) {
            WeeklyAccomplishment::create([
                'foreman_id'        => Auth::id(),
                'week_start'        => $request->week_start,
                'scope_of_work'     => $scope['scope_of_work'],
                'percent_completed' => $scope['percent_completed'],
            ]);
        }

        return back()->with('success', 'Weekly accomplishment submitted.');
    }

    public function storeMaterialRequest(Request $request)
    {
        $request->validate([
            'items' => 'required|array',
            'items.*.material_name' => 'required|string',
            'items.*.quantity'      => 'required|string',
            'items.*.unit'          => 'required|string',
            'items.*.remarks'       => 'nullable|string',
        ]);

        foreach ($request->items as $item) {
            MaterialRequest::create([
                'foreman_id'    => Auth::id(),
                'material_name' => $item['material_name'],
                'quantity'      => $item['quantity'],
                'unit'          => $item['unit'],
                'remarks'       => $item['remarks'] ?? null,
            ]);
        }

        return back()->with('success', 'Material request submitted.');
    }

    public function storeIssueReport(Request $request)
    {
        $request->validate([
            'issue_title' => 'required|string',
            'description' => 'required|string',
            'severity'    => 'required|in:low,medium,high',
        ]);

        IssueReport::create([
            'foreman_id'  => Auth::id(),
            'issue_title' => $request->issue_title,
            'description' => $request->description,
            'severity'    => $request->severity,
        ]);

        return back()->with('success', 'Issue reported.');
    }

    public function storeProgressPhoto(Request $request)
    {
        $request->validate([
            'photo'   => 'required|image|max:5120',
            'caption' => 'nullable|string',
        ]);

        $path = $request->file('photo')->store('progress-photos', 'public');

        ProgressPhoto::create([
            'foreman_id' => Auth::id(),
            'photo_path' => $path,
            'caption'    => $request->caption,
        ]);

        return back()->with('success', 'Photo uploaded.');
    }

    public function storeDelivery(Request $request)
    {
        $request->validate([
            'item_delivered' => 'required|string',
            'quantity'       => 'required|string',
            'delivery_date'  => 'required|date',
            'supplier'       => 'nullable|string',
            'status'         => 'required|in:received,incomplete,rejected',
        ]);

        DeliveryConfirmation::create([
            'foreman_id'     => Auth::id(),
            'item_delivered' => $request->item_delivered,
            'quantity'       => $request->quantity,
            'delivery_date'  => $request->delivery_date,
            'supplier'       => $request->supplier,
            'status'         => $request->status,
        ]);

        return back()->with('success', 'Delivery confirmed.');
    }
}