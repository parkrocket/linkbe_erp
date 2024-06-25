import React from 'react';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { loginUser } from '../_actions/user_action';

function Login() {
    const [email, setEamil] = useState('');
    const [password, setPassword] = useState('');

    const dispatch = useDispatch();

    const onSubmit = (e) => {
        e.preventDefault();

        const loginData = {
            email,
            password,
        };

        console.log(email, password);

        dispatch(loginUser(loginData)).then((response) => {
            console.log(response);
        });
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100vh' }}>
            <form style={{ display: 'flex', flexDirection: 'column' }} onSubmit={onSubmit}>
                <input type="text" placeholder="ID" value={email} onChange={(e) => setEamil(e.target.value)} />
                <input type="password" placeholder="PW" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="submit">Login</button>
            </form>
        </div>
    );
}

export default Login;
