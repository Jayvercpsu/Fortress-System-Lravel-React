import Layout from '../../../Components/Layout';
import ProjectsKanbanPage from '../../../Components/ProjectsKanbanPage';
import { Head } from '@inertiajs/react';

export default function AdminProjectsIndex({ projectBoard = {} }) {
    return (
        <>
            <Head title="Projects" />
            <Layout title="Projects">
                <ProjectsKanbanPage
                    projectBoard={projectBoard}
                />
            </Layout>
        </>
    );
}
