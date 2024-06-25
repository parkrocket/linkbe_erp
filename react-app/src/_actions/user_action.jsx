import axios from 'axios';
import { SERVER_URL } from '../Config';

import { LOGIN_USER } from './types';

export function loginUser(dataTosubmit) {
    return (dispatch) => {
        return new Promise((resolve) => {
            const request = { success: true, mb_id: 'admin' }; // 임시로 비동기 응답을 모방
            dispatch({
                type: LOGIN_USER,
                payload: request,
            });
            resolve(request);
        });
    };

    //const request = axios.post(`${SERVER_URL}/api/users/login`, dataTosubmit).then((response) => response.data);
    /*
    return {
        type: LOGIN_USER,
        payload: request,
    };
    */
}
