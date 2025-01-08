import React, { useState } from 'react';
import FullCalendar from '@fullcalendar/react'; // FullCalendar 컴포넌트
import dayGridPlugin from '@fullcalendar/daygrid'; // DayGrid 뷰
import googleCalendarPlugin from '@fullcalendar/google-calendar'; // Google Calendar 플러그인
import interactionPlugin from '@fullcalendar/interaction'; // 사용자 입력 처리
import axios from 'axios';
import CalendarStyle from '../css/Calendar.module.scss';
import SERVER_URL from '../Config';

function Calendar() {
    const [events, setEvents] = useState([]); // 로컬 이벤트 상태 관리

    // Google Calendar API 데이터를 FullCalendar 형식으로 변환하는 함수
    const transformGoogleEventsToFullCalendarEvents = googleEvents => {
        return googleEvents.map(event => ({
            id: event.id,
            title: event.summary,
            start: event.start.dateTime || event.start.date,
            end: event.end.dateTime || event.end.date,
            allDay: !!event.start.date,
            extendedProps: {
                description: event.description,
                creator: event.creator?.email,
            },
        }));
    };

    // 서버에서 이벤트를 가져오는 함수
    const fetchEvents = async (start, end) => {
        try {
            const response = await axios.get(
                `${SERVER_URL}/api/calendar/events`,
                {
                    params: {
                        timeMin: start.toISOString(), // 시작 날짜를 ISO 문자열로 변환
                        timeMax: end.toISOString(), // 종료 날짜를 ISO 문자열로 변환
                    },
                },
            );
            const transformedEvents = transformGoogleEventsToFullCalendarEvents(
                response.data,
            );
            setEvents(transformedEvents); // 변환된 이벤트로 상태 업데이트
        } catch (error) {
            console.error('Error fetching events:', error);
        }
    };

    // FullCalendar의 날짜 범위가 변경될 때 호출되는 함수
    const handleDatesSet = dateInfo => {
        const { start, end } = dateInfo; // 현재 캘린더 범위 가져오기
        fetchEvents(start, end); // 서버에서 해당 범위의 이벤트 가져오기
    };

    // 새 이벤트 추가
    const handleDateClick = info => {
        const title = prompt('일정 제목을 입력하세요:');
        if (title) {
            const newEvent = {
                title,
                start: info.dateStr,
                allDay: true,
            };
            setEvents([...events, newEvent]); // 로컬 상태 업데이트
            addEventToGoogleCalendar(newEvent); // 서버로 전송
        }
    };

    // 이벤트 수정
    const handleEventClick = info => {
        const newTitle = prompt('새 일정 제목을 입력하세요:', info.event.title);
        if (newTitle) {
            info.event.setProp('title', newTitle); // FullCalendar에서 즉시 업데이트
            updateEventInGoogleCalendar(info.event); // 서버로 전송
        }
    };

    // Google Calendar에 이벤트 추가
    const addEventToGoogleCalendar = async event => {
        try {
            const response = await axios.post(`${SERVER_URL}/api/calendar/in`, {
                summary: event.title,
                start: event.start,
                end: event.start,
            });

            console.log('Event added:', response.data);
        } catch (error) {
            console.error('Error adding event to Google Calendar:', error);
        }
    };

    // Google Calendar에 이벤트 수정
    const updateEventInGoogleCalendar = async event => {
        try {
            const response = await axios.put(
                `${SERVER_URL}/api/calendar/update`,
                {
                    id: event.id, // 이벤트 ID
                    summary: event.title, // 수정된 제목
                },
            );
            console.log('Event updated:', response.data);
        } catch (error) {
            console.error('Error updating event:', error);
        }
    };

    return (
        <div className={CalendarStyle.calendarContainer}>
            <h1 className={CalendarStyle.calendarTitle}>
                Google Calendar 연동
            </h1>
            <FullCalendar
                plugins={[
                    dayGridPlugin,
                    googleCalendarPlugin,
                    interactionPlugin,
                ]}
                initialView="dayGridMonth"
                events={events} // 변환된 이벤트 전달
                datesSet={handleDatesSet} // 날짜 범위가 변경될 때 호출
                eventTimeFormat={{
                    hour: '2-digit',
                    minute: '2-digit',
                    meridiem: false,
                }}
                dateClick={handleDateClick} // 날짜 클릭 이벤트 핸들러
                eventClick={handleEventClick} // 일정 클릭 이벤트 핸들러
            />
        </div>
    );
}

export default Calendar;
