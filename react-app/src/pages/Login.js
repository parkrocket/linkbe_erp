import React from 'react';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { loginUser } from '../_actions/user_action';
import { useNavigate } from 'react-router-dom';
import { useCookies } from 'react-cookie';

function Login() {
    const [email, setEamil] = useState('');
    const [password, setPassword] = useState('');
    const [, setCookie] = useCookies(['x_auth']);
    const navigate = useNavigate();

    const dispatch = useDispatch();

    const onSubmit = (e) => {
        e.preventDefault();

        const loginData = {
            email,
            password,
        };

        dispatch(loginUser(loginData)).then((response) => {
            if (response.payload.loginSuccess) {
                setCookie('x_auth', response.payload.token);
                window.localStorage.setItem('userId', response.payload.user.mb_id);
                navigate('/');
            } else {
                alert(response.payload.error);
            }
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
