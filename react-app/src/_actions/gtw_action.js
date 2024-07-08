import axios from 'axios';
import SERVER_URL from '../Config';

import { GTW_STATUS, GTW } from './types';

export function gtw(dataTosubmit) {
    const request = axios.post(`${SERVER_URL}/api/gtw/companyIn`, dataTosubmit).then((response) => response.data);

    return {
        type: GTW,
        payload: request,
    };
}

export function gtwStatus(dataTosubmit) {
    const request = axios.post(`${SERVER_URL}/api/gtw/gtwStatus`, dataTosubmit).then((response) => response.data);

    return {
        type: GTW_STATUS,
        payload: request,
    };
}
