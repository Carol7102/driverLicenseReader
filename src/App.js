import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createWorker } from 'tesseract.js';
const App = () => {
  const [extractedText, setExtractedText] = useState('');
  const [webcamActive, setWebcamActive] = useState(false);
  const [stateName, setStateName] = useState('');
  const [image, setImage] = useState(null);
  const [fullNameF, setFullNameF] = useState('');
  const [addressF, setAddressF] = useState('');
  const [issuanceDateF, setIssuanceDateF] = useState('');
  const [expirationDateF, setExpirationDateF] = useState('');
  let fullName = '';
  
  let address = '';
  
  let issuanceDate = '';
  
  let expirationDate = '';
  const [reprocessNeeded, setReprocessNeeded] = useState(false);
  
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  const parseText = useCallback((lines) => {
    if (stateName === 'CA') {
      fillCATemplate(lines);
    }
    
    else console.log("wrong state name");
  }, [stateName]);

  useEffect(() => {
    if (webcamActive && reprocessNeeded) {
      const timer = setTimeout(() => {
        console.log("timeout");
        setReprocessNeeded(false);
      }, 20000); // Stop reprocessing after 10 seconds
      console.log("before reprocess, expirationDate:", expirationDate);
      console.log("before reprocess, reprocessNeeded:", reprocessNeeded);
      processImg();
      console.log("after reprocess, expirationDate:", expirationDate);
      console.log("before reprocess, reprocessNeeded:", reprocessNeeded);

      return () => clearTimeout(timer);
    }
  }, [webcamActive, reprocessNeeded]);
  
  useEffect(() => {
    if (webcamActive) {
      const getImg = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        document.querySelector('video').srcObject = stream;

        const track = stream.getVideoTracks()[0];
        const imageCapture = new ImageCapture(track);
        const captureFrame = async () => {
          try {
            // Grab a frame from the video stream
            const imageBitmap = await imageCapture.grabFrame();
      
            // Convert the imageBitmap to a data URL
            const canvas = document.createElement('canvas');
            canvas.width = imageBitmap.width;
            canvas.height = imageBitmap.height;
            canvas.willReadFrequently = true;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imageBitmap, 0, 0);
            const imageURL = canvas.toDataURL('image/jpeg');
      
            // Set the captured image as the source for an <img> element
            setImage(imageURL);
          } catch (error) {
            console.error('Error grabbing frame:', error);
          }
        };
      
        // Capture a frame from the video stream every 1000 milliseconds
        setInterval(captureFrame, 1000);
      };
      getImg();
    }
  }, [webcamActive]); // Run when webcamActive state changes

  const processImg = async () => {
    setReprocessNeeded(false);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(imageRef.current, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg");
    // Create a new instance of the Tesseract.js worker
    const worker = await createWorker();

    // Perform OCR on the captured image
    const { data: { lines, text, confidence } } = await worker.recognize(dataUrl);
    // console.log(lines);
    console.log(confidence);
    setExtractedText(text);

    // Terminate the Tesseract.js worker
    await worker.terminate();
    parseText(lines);
    // return lines;
  }
  const fillCATemplate = (lines) => {
    let currFullName = '';
    let currAddress = '';
    let currIssuanceDate = '';
    let currExpirationDate = '';
    let currLN = '';
    let currFN = '';
    // Iterate through each line of text
    console.log('lines: ', lines);
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].text.trim();
      line = line.toUpperCase();
      console.log("line:", line);
      // Check for expiration date
      console.log("expirationDate: (ksdjafoidasjf): ", expirationDate)
      if (!expirationDate && (currExpirationDate === '' && (line.match(/\d{2}\/\d{2}\/\d{4}/) && line.includes('EXP')))) {
        let exp = line.match(/\d{2}\/\d{2}\/\d{4}/)[0];
        currExpirationDate = exp.trim();
        console.log('expirationDate:', currExpirationDate);
      }

      // Check for last name
      if (!currLN && line.includes('LN')) {
        const words = line.split('LN');
        if (words.length > 1) {
          console.log("line.split('LN')[1]: ", line.split('LN')[1]);
          currLN = line.split('LN')[1].split(' ')[0];
          console.log('ln: ', currLN);
        } else {
          console.log("format error: LN with empty words");
        }
      }

      // Check for first name and address
      if (!currFN && line.includes('FN')) {
        currFN = line.split('FN')[1].split(' ')[0].trim();
        console.log('fn: ', currFN);
        // get address in next two lines
        if (!address) {
          if (i+1 < lines.length) {
            i = i + 1;
            let addrLine1 = lines[i].text.trim();
            // Remove all non-number characters from the beginning
            addrLine1 = addrLine1.replace(/^\D+/g, '');
            i = i + 1;
            const addrLine2 = lines[i].text.trim();
            currAddress = addrLine1 + ' ' + addrLine2;
            console.log('addr: ', currAddress);
          } else {
            console.log("format error: fn in the last line")
          }
        }
      }

      if (currLN && currFN) {
        currFullName = currFN + ' ' + currLN;
        console.log("currFullName:", currFullName);
      }
      // Check for issuance date
      if (!issuanceDate && i === lines.length - 1) {
        let parts = line.split(' ');
        let issDate = parts[parts.length - 1];
        if (issDate.match(/\d{2}\/\d{2}\/\d{4}/)) {
          let patterns = issDate.match(/\d{2}\/\d{2}\/\d{4}/);
          currIssuanceDate = patterns[patterns.length - 1];
        } else {
          console.log("format error: issDate not match the pattern");
        }
        
        console.log('issDate: ', currIssuanceDate);
      }
    
    }
    // Check if any required fields are missing
    console.log("finish parse");
    console.log("address:", address, " expirationDate:", expirationDate, " fullName:", fullName, " issuanceDate:", issuanceDate);
    if (address === '') {
      //setAddress(currAddress);
      address = currAddress;
    }
    if (expirationDate === '') {
      console.log('is there to set exp date? currExpirationDate:', currExpirationDate);
      expirationDate = currExpirationDate;
      // setExpirationDate(currExpirationDate);
      console.log("just set expiration date, the expirationDate:", expirationDate);
    }
    if (fullName === '') {
      //setFullName(currFullName);
      fullName = currFullName;
    }
    if (issuanceDate === '') {
      //setIssuanceDate(currIssuanceDate);
      issuanceDate = currIssuanceDate;
    }
    console.log("finish assignment");
    console.log("address:", address, " expirationDate:", expirationDate, " fullName:", fullName, " issuanceDate:", issuanceDate);
    if (fullName === '' || address === '' || issuanceDate === '' || expirationDate === '') {
      console.log("not all element parsed, reprocess image again");
      setReprocessNeeded(true);
    } else {
      console.log("all element parsed");
      setReprocessNeeded(false);
      setFullNameF(fullName);
      setAddressF(address);
      setIssuanceDateF(issuanceDate);
      setExpirationDateF(expirationDate);

    }
  }
  

  const handleStartWebcam = () => {
    setWebcamActive(true);
  };

  return (
    <div>
      <h1>Driver-License-Reader</h1>
      {webcamActive && (
        <>
          <p>Current State: {stateName}</p>
          <h3>Actual image uploaded</h3>
          <img 
            src={image} 
            className="App-logo" 
            alt="logo"
            ref={imageRef} 
          />
          <h3>Canvas</h3>
          <canvas ref={canvasRef} width={700} height={500}></canvas>
          <p>Extracted Text: {extractedText}</p>
          <div>
            <label>Full Name:</label>
            <input 
              type="text" 
              value={fullNameF} 
              onChange={(e) => setFullNameF(e.target.value)}
            />
          </div>
          <div>
            <label>Address:</label>
            <input 
              type="text" 
              value={addressF} 
              onChange={(e) => setAddressF(e.target.value)}
            />
          </div>
          <div>
            <label>DL Issuance Date:</label>
            <input 
              type="text" 
              value={issuanceDateF} 
              onChange={(e) => setIssuanceDateF(e.target.value)}
            />
          </div>
          <div>
            <label>DL Expiration Date:</label>
            <input 
              type="text" 
              value={expirationDateF} 
              onChange={(e) => setExpirationDateF(e.target.value)}
            />
          </div>
          <video autoPlay playsInline style={{ width: '100%', maxWidth: '600px' }}></video>
          <button onClick={processImg}>Get Info</button>
          <button onClick={() => setWebcamActive(false)}>Take Another Photo</button>
        </>
      )}
      {!webcamActive && (
        <>
          <select onChange={(e) => setStateName(e.target.value)}>
            <option>select your state</option>
            <option value="CA">CA</option>
          </select>
          <button onClick={handleStartWebcam}>Start Webcam</button>
        </>
      )}
    </div>
  );
  
};

export default App;

