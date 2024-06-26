import React from 'react';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { registerUser } from '../_actions/user_action';
import { useNavigate } from 'react-router-dom';

function Register() {
    const [email, setEamil] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const dispatch = useDispatch();

    const onSubmit = (e) => {
        e.preventDefault();

        const loginData = {
            email,
            password,
        };

        dispatch(registerUser(loginData)).then((response) => {
            if (response.payload.loginSuccess) {
                console.log(response);
                //navigate('/login');
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
                <button type="submit">Register</button>
            </form>
        </div>
    );
}

export default Register;
