import axios from 'axios';
import SERVER_URL from '../Config';

import {
    LOGIN_USER,
    REGISTER_USER,
    AUTH_USER,
    LOGOUT_USER,
    REFRESH_USER,
} from './types';

export function loginUser(dataTosubmit) {
    const request = axios
        .post(`${SERVER_URL}/api/users/login`, dataTosubmit)
        .then(response => response.data);

    return {
        type: LOGIN_USER,
        payload: request,
    };
}

export function registerUser(dataTosubmit) {
    const request = axios
        .post(`${SERVER_URL}/api/users/register`, dataTosubmit)
        .then(response => response.data);

    return {
        type: REGISTER_USER,
        payload: request,
    };
}

export function auth(dataTosubmit) {
    const request = axios
        .post(`${SERVER_URL}/api/users/auth`, dataTosubmit)
        .then(response => response.data);

    return {
        type: AUTH_USER,
        payload: request,
    };
}

export function refresh(dataTosubmit) {
    console.log(dataTosubmit);

    const request = axios
        .post(`${SERVER_URL}/api/users/refresh`, dataTosubmit)
        .then(response => response.data);

    return {
        type: REFRESH_USER,
        payload: request,
    };
}

export function logout(dataTosubmit) {
    localStorage.removeItem('userId');

    const request = axios
        .post(`${SERVER_URL}/api/users/logout`, dataTosubmit)
        .then(response => response.data);

    return {
        type: LOGOUT_USER,
        payload: request,
    };
}
