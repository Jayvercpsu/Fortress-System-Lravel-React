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
    public function submitAll(Request $request)
    {
        $request->validate([
            'attendance'                         => 'nullable|array',
            'attendance.*.worker_name'           => 'required_with:attendance|string',
            'attendance.*.worker_role'           => 'required_with:attendance|string',
            'attendance.*.date'                  => 'required_with:attendance|date',
            'attendance.*.hours'                 => 'required_with:attendance|numeric|min:0',

            'week_start'                         => 'nullable|date',
            'scopes'                             => 'nullable|array',
            'scopes.*.scope_of_work'             => 'required_with:scopes|string',
            'scopes.*.percent_completed'         => 'required_with:scopes|numeric|min:0|max:100',

            'material_items'                     => 'nullable|array',
            'material_items.*.material_name'     => 'required_with:material_items|string',
            'material_items.*.quantity'          => 'required_with:material_items|string',
            'material_items.*.unit'              => 'required_with:material_items|string',
            'material_items.*.remarks'           => 'nullable|string',

            'issue_title'                        => 'nullable|string',
            'description'                        => 'nullable|string',
            'severity'                           => 'nullable|in:low,medium,high',

            'item_delivered'                     => 'nullable|string',
            'quantity'                           => 'nullable|string',
            'delivery_date'                      => 'nullable|date',
            'supplier'                           => 'nullable|string',
            'status'                             => 'nullable|in:received,incomplete,rejected',
        ]);

        $foremanId = Auth::id();
 
        if (!empty($request->attendance)) {
            foreach ($request->attendance as $entry) {
                Attendance::create([
                    'foreman_id'  => $foremanId,
                    'worker_name' => $entry['worker_name'],
                    'worker_role' => $entry['worker_role'],
                    'date'        => $entry['date'],
                    'hours'       => $entry['hours'],
                ]);
            }
        } 

        if (!empty($request->scopes) && $request->week_start) {
            foreach ($request->scopes as $scope) {
                if ($scope['percent_completed'] !== '' && $scope['percent_completed'] !== null) {
                    WeeklyAccomplishment::create([
                        'foreman_id'        => $foremanId,
                        'week_start'        => $request->week_start,
                        'scope_of_work'     => $scope['scope_of_work'],
                        'percent_completed' => $scope['percent_completed'],
                    ]);
                }
            }
        }
 
        if (!empty($request->material_items)) {
            foreach ($request->material_items as $item) {
                if (!empty($item['material_name'])) {
                    MaterialRequest::create([
                        'foreman_id'    => $foremanId,
                        'material_name' => $item['material_name'],
                        'quantity'      => $item['quantity'],
                        'unit'          => $item['unit'],
                        'remarks'       => $item['remarks'] ?? null,
                    ]);
                }
            }
        }
 
        if (!empty($request->issue_title) && !empty($request->description)) {
            IssueReport::create([
                'foreman_id'  => $foremanId,
                'issue_title' => $request->issue_title,
                'description' => $request->description,
                'severity'    => $request->severity ?? 'medium',
            ]);
        }
 
        if (!empty($request->item_delivered) && !empty($request->delivery_date)) {
            DeliveryConfirmation::create([
                'foreman_id'     => $foremanId,
                'item_delivered' => $request->item_delivered,
                'quantity'       => $request->quantity,
                'delivery_date'  => $request->delivery_date,
                'supplier'       => $request->supplier,
                'status'         => $request->status ?? 'received',
            ]);
        }

        return back()->with('success', 'All entries submitted successfully.');
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
}