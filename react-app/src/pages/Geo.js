import React, { useState, useEffect } from 'react';

const Geo = () => {
    const [location, setLocation] = useState({
        latitude: null,
        longitude: null,
    });

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    setLocation({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    });
                },
                error => {
                    console.error('Error getting geolocation:', error);
                },
            );
        } else {
            console.error('Geolocation is not supported by this browser.');
        }
    }, []);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = `https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=vev4vr3yem`;
        script.async = true;
        script.onload = () => {
            if (location.latitude && location.longitude) {
                console.log(location.latitude, location.longitude);

                const mapOptions = {
                    center: new window.naver.maps.LatLng(
                        location.latitude,
                        location.longitude,
                    ),
                    zoom: 10,
                };
                const map = new window.naver.maps.Map('map', mapOptions);
                new window.naver.maps.Marker({
                    position: new window.naver.maps.LatLng(
                        location.latitude,
                        location.longitude,
                    ),
                    map: map,
                });
            }
        };
        document.head.appendChild(script);
    }, [location]);

    return (
        <div>
            <h2>사용자의 위치 정보</h2>
            {location.latitude && location.longitude ? (
                <div id="map" style={{ width: '100%', height: '400px' }}></div>
            ) : (
                <p>위치 정보를 가져오는 중...</p>
            )}
        </div>
    );
};

export default Geo;
