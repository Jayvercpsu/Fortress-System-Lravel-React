import { readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export interface TestAccount {
    email: string;
    password: string;
    role: string;
    fullname: string;
    landingPath: string;
    label: string;
    default_rate_per_hour?: number;
}

export interface TestProject {
    id: number;
    name: string;
    client: string;
    type: string;
    location: string;
    status: string;
    phase: string;
    contract_amount: number;
    target: string;
}

export interface TestWorker {
    foreman_email: string;
    name: string;
    job_type: string;
    default_rate_per_hour: number;
    birth_date: string;
    place_of_birth: string;
    sex: string;
    civil_status: string;
    phone: string;
    address: string;
}

export interface TestProjectScope {
    project: string;
    scope_name: string;
    assigned_personnel: string;
    progress_percent: number;
    status: string;
    remarks: string;
    contract_amount: number;
    weight_percent: number;
    start_date: string;
    target_completion: string;
}

export interface TestPayrollCutoff {
    start_date: string;
    end_date: string;
    status: string;
}

export interface TestData {
    accounts: Record<string, TestAccount>;
    projects: Record<string, TestProject>;
    workers: TestWorker[];
    project_scopes: TestProjectScope[];
    payroll_cutoffs: TestPayrollCutoff[];
    demo_tokens: {
        primary: string;
        co_foreman: string;
    };
}

let cachedData: TestData | null = null;

export function loadTestData(): TestData {
    if (cachedData) {
        return cachedData;
    }

    const yamlPath = path.resolve(process.cwd(), 'tests/e2e/fixtures/test-data.yml');
    const fileContents = readFileSync(yamlPath, 'utf8');
    cachedData = YAML.parse(fileContents) as TestData;
    return cachedData;
}