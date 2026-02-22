import UserFormPage from '../../../Components/UserFormPage';

export default function CreateUser({ user }) {
    return <UserFormPage mode="create" user={user} />;
}
