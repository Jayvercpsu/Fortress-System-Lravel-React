import UserFormPage from '../../../Components/UserFormPage';

export default function EditUser({ user }) {
    return <UserFormPage mode="edit" user={user} />;
}
