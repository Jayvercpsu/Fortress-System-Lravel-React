<?php
namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder {
    public function run(): void {
        User::create([
            'fullname' => 'Head Administrator',
            'email'    => 'headadmin@buildbooks.com',
            'password' => Hash::make('password'),
            'role'     => 'head_admin',
        ]);

        $this->call(ProjectSeeder::class);
    }
}
