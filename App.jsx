import React, { useState, useEffect } from 'react';
import axios from 'axios';
import firebase from 'firebase/compat/app';
import 'firebase/compat/database';
import firebaseConfig from './firebaseconfig';
import * as XLSX from 'xlsx';

const YouTubeLikes = () => {
  const [videoUrl, setVideoUrl] = useState('');
  const [currentCollection, setCurrentCollection] = useState(null);
  const [likesData, setLikesData] = useState([]);
  const [intervalId, setIntervalId] = useState(null);
  const [videoInfo, setVideoInfo] = useState(null);
  const [viewsGain, setViewsGain] = useState(0);

  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();

  useEffect(() => {
    if (currentCollection) {
      const likesRef = db.ref(`likesData/${currentCollection}`);
      likesRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setLikesData(Object.values(data));
        }
      });
    }
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(intervalId);
    };
  }, [currentCollection, db, intervalId]);

  const handleBeforeUnload = () => {
    clearInterval(intervalId);

    if (likesData.length > 0 && currentCollection) {
      const lastEntry = likesData[0];
      saveLikesDataToRTDB(lastEntry);
    }
  };

  const createNewCollection = () => {
    const collectionName = getVideoId(videoUrl);
    setCurrentCollection(collectionName);
    setLikesData([]);
    db.ref(`likesData/${collectionName}`).push({});
  };

  const saveLikesDataToRTDB = async (data) => {
    if (currentCollection) {
      const likesRef = db.ref(`likesData/${currentCollection}`);
      await likesRef.push(data);
    }
  };

  const fetchLikes = async () => {
    try {
      const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${getVideoId(
          videoUrl
        )}&key=AIzaSyDnuz5bJJMat-5BEBQapnYg6qC2Q04Jvsg`
      );

      const { items } = response.data;

      if (items && items.length > 0 && items[0].snippet) {
        const { viewCount } = items[0].statistics;

        const newEntry = {
          timestamp: new Date().toLocaleTimeString(),
          views: viewCount,
          viewsGain:
            likesData.length > 0
              ? viewCount - likesData[0].views
              : 0,
        };

        if (
          likesData.length === 0 ||
          viewCount - likesData[0].views > 0
        ) {
          setLikesData((prevData) => [newEntry, ...prevData]);
          saveLikesDataToRTDB(newEntry);
        }

        setVideoInfo({
          title: items[0].snippet.title,
          channelTitle: items[0].snippet.channelTitle,
        });

        setViewsGain(newEntry.viewsGain);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const startTrackingDB = () => {
    startTracking();
    // alert('Started saving the data to the database!'); // Commented out or removed
  };

  const startTracking = () => {
    clearInterval(intervalId);

    const newCollection = getVideoId(videoUrl);
    if (newCollection !== currentCollection) {
      createNewCollection();
    }

    fetchLikes();

    const newIntervalId = setInterval(fetchLikes, 30 * 10 * 1000);
    setIntervalId(newIntervalId);
  };

  const getVideoId = (url) => {
    const urlParams = new URLSearchParams(new URL(url).search);
    return urlParams.get('v');
  };

  const saveToExcel = () => {
    const data = likesData.map((entry) => [
      entry.timestamp,
      entry.views,
      entry.viewsGain,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([
      ['Timestamp', 'Views', 'Gain/Loss'],
      ...data,
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet 1');
    XLSX.writeFile(wb, `${videoInfo.title}_data.xlsx`);
  };

  return (
    <div className="container mt-4">
      <h1 className="display-4">Youtube-Data-Tracker</h1>
      <p className="text-muted">Managed by Pranav Patil</p>

      <label className="mt-3">
        Enter YouTube Video URL:
        <input
          type="text"
          className="form-control"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />
      </label>
      <button className="btn btn-primary ml-3" onClick={startTracking}>
        <i className="bi bi-search rounded" />
      </button>
      <br />
      <button
        className="btn btn-success rounded mr-3 mt-3"
        onClick={startTrackingDB}
      >
        Start Tracking Data
      </button>
      <button className="btn btn-warning mt-3" onClick={saveToExcel}>
        Save to Excel
      </button>

      {videoInfo && (
        <div className="mt-3">
          <p>
            <strong>Video Title:</strong> {videoInfo.title}
            <br />
            <strong>Channel:</strong> {videoInfo.channelTitle}
          </p>
        </div>                        
      )}

      {likesData.length > 0 && (
        <p className="mt-3">
          Views gained since last update: {viewsGain}
        </p>
      )}

      {likesData.length > 0 && (
        <table className="table mt-4">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Views</th>
              <th>Gain/Loss</th>
            </tr>
          </thead>
          <tbody>
            {likesData.map((entry, index) => (
              <tr key={index}>
                <td>{entry.timestamp}</td>
                <td>{entry.views}</td>
                <td>{entry.viewsGain}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default YouTubeLikes;
