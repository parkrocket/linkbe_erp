import axios from 'axios';
import { SERVER_URL } from './Config';

import { LOGIN_USER } from './types';

export function loginUser(dataTosubmit) {
    //const request = axios.post(`${SERVER_URL}/api/users/login`, dataTosubmit).then((response) => response.data);

    const request = { success: true, mb_id: 'admin' };
    return {
        type: LOGIN_USER,
        payload: request,
    };
}
