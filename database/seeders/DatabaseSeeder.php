<?php
namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder {
    public function run(): void {
        User::updateOrCreate([
            'email'    => 'headadmin@buildbooks.com',
        ], [
            'fullname' => 'Head Administrator',
            'password' => Hash::make('password'),
            'role'     => 'head_admin',
        ]);

        $this->call(FortressBuildingFlowSeeder::class);
    }
}
