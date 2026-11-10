import React,{useEffect,useRef,useState} from 'react';
import {Box,Plus,Upload,MessageSquare,Settings,Send,Sparkles,PanelLeft,Download,RotateCcw,Layers,ChevronDown,FileBox} from 'lucide-react';
import ModelViewer from './ModelViewer.jsx';

const formats=['glb','gltf','fbx','obj','stl','ply','3mf','dae','usdz'];
const STORAGE_KEY='nova-studio-conversation-v1';
const welcomeMessage={role:'assistant',text:'Hello! I’m Nova. You can talk with me about 3D design, software, ideas or everyday questions. I’ll keep the recent conversation on this device so we can continue after a refresh.'};

function readSavedMessages(){
 try{
  const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
  if(Array.isArray(parsed)){
   const valid=parsed.filter(item=>
    item&&['user','assistant'].includes(item.role)&&typeof item.text==='string'
   ).slice(-80);
   if(valid.length)return valid;
  }
 }catch{}
 return [welcomeMessage];
}

export default function App(){
 const viewerRef=useRef(null);
 const [file,setFile]=useState(null);
 const [messages,setMessages]=useState(readSavedMessages);
 const [prompt,setPrompt]=useState('');
 const [model,setModel]=useState('Nova Studio');
 const [busy,setBusy]=useState(false);
 const [dragging,setDragging]=useState(false);
 const [stats,setStats]=useState(null);
 const [gridOn,setGridOn]=useState(true);
 const [apiReady,setApiReady]=useState(false);

 useEffect(()=>{
  fetch('/api/v1/health')
   .then(response=>response.json())
   .then(data=>setApiReady(Boolean(data.configured)))
   .catch(()=>setApiReady(false));
 },[]);

 useEffect(()=>{
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(messages.slice(-80)))}
  catch{/* Browser storage can be unavailable or full. */}
 },[messages]);

 const acceptFile=selectedFile=>{
  if(!selectedFile)return;
  const extension=selectedFile.name.split('.').pop().toLowerCase();
  if(!formats.includes(extension)){
   setMessages(current=>[...current,{role:'assistant',text:'Unsupported extension: .'+extension+'. Supported formats: '+formats.join(', ')}]);
   return;
  }
  setFile(selectedFile);
  setStats(null);
  setMessages(current=>[...current,{role:'assistant',text:'Imported '+selectedFile.name+'. I can use its structural statistics in our conversation, but I cannot visually inspect the model from statistics alone.'}]);
 };

 const upload=event=>{
  acceptFile(event.target.files?.[0]);
  event.target.value='';
 };
 const onDrop=event=>{
  event.preventDefault();
  setDragging(false);
  acceptFile(event.dataTransfer.files?.[0]);
 };
 const newProject=()=>{
  viewerRef.current?.clearScene();
  setFile(null);
  setStats(null);
  setPrompt('');
  setMessages([welcomeMessage]);
 };
 const send=async()=>{
  const text=prompt.trim();
  if(!text||busy)return;
  setPrompt('');
  const conversation=[...messages,{role:'user',text}].slice(-16);
  setMessages(conversation);
  setBusy(true);
  try{
   const extension=file?.name.split('.').pop().toLowerCase();
   const asset=file?{filename:file.name,format:extension,stats:stats||null}:null;
   const response=await fetch('/api/v1/chat',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
     messages:conversation.map(item=>({role:item.role,content:item.text})),
     mode:model,
     asset
    })
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||'Nova API request failed (HTTP '+response.status+').');
   const actions=Array.isArray(data.actions)?data.actions:[];
   if(actions.length){
    const outcomes=viewerRef.current?.applyActions(actions)||actions.map(action=>({type:action.type,ok:false,reason:'No active 3D scene'}));
    const applied=outcomes.filter(result=>result.ok).length;
    const failed=outcomes.length-applied;
    let confirmation=applied
     ? 'Applied '+applied+' of '+actions.length+' requested scene change(s) in the viewport.'
     : 'I could not apply the requested scene changes. Check that the target object names match.';
    if(failed&&applied)confirmation+=' '+failed+' change(s) could not be applied.';
    if(applied===actions.length&&typeof data.reply==='string'&&data.reply.trim())confirmation+='\\n\\n'+data.reply.trim();
    setMessages(current=>[...current,{role:'assistant',text:confirmation}].slice(-80));
   }else{
    if(typeof data.reply!=='string'||!data.reply.trim())throw new Error('Nova API returned an empty response.');
    setMessages(current=>[...current,{role:'assistant',text:data.reply.trim()}].slice(-80));
   }
  }catch(error){
   setMessages(current=>[...current,{role:'assistant',text:error.message||'Nova could not connect to its API. Check the server and provider configuration.'}].slice(-80));
  }finally{
   setBusy(false);
  }
 };

 return <div className="shell">
  <aside className="sidebar">
   <div className="brand"><div className="brandmark"><Box size={21}/></div><div><b>NOVA</b><small>3D AI STUDIO</small></div></div>
   <button className="new" onClick={newProject}><Plus size={16}/> New project</button>
   <div className="navlabel">WORKSPACE</div>
   <div className="nav active"><Layers size={17}/> Studio</div>
   <button className="nav" onClick={()=>setMessages(readSavedMessages())}><MessageSquare size={17}/> Conversations</button>
   <button className="nav" onClick={()=>document.getElementById('nova-file-input')?.click()}><FileBox size={17}/> Assets</button>
   <div className="sidebottom">
    <a className="nav" href="/api/v1/openapi.json" target="_blank" rel="noreferrer"><Settings size={17}/> Nova API docs</a>
    <div className="profile"><div className="avatar">N</div><div><b>Local workspace</b><small>Personal plan</small></div></div>
   </div>
  </aside>
  <main className="main">
   <header>
    <div className="crumb"><PanelLeft size={17}/><span>Workspace</span><i>/</i><b>Untitled project</b></div>
    <div className="headerRight"><span className="status"><span/> {apiReady?'Nova API connected':'Nova API not configured'}</span><button className="share" onClick={()=>viewerRef.current?.exportGLB().catch(error=>setMessages(current=>[...current,{role:'assistant',text:error.message}]))}><Download size={14}/> Export GLB</button></div>
   </header>
   <div className="workspace">
    <section className="viewportPanel">
     <div className="paneltop">
      <div><b>3D VIEWPORT</b><small>{file?file.name:stats?'AI-generated scene':'No asset loaded'}</small></div>
      <div className="tools">
       <label className="toolbtn"><Upload size={15}/> Import<input id="nova-file-input" type="file" accept={formats.map(value=>'.'+value).join(',')} onChange={upload} hidden/></label>
       <button className="toolbtn" onClick={()=>setGridOn(viewerRef.current?.toggleGrid()??gridOn)}><Layers size={15}/> Grid {gridOn?'On':'Off'}</button>
       <button className="toolbtn" onClick={()=>{viewerRef.current?.clearScene();setFile(null);setStats(null)}}><RotateCcw size={15}/> Clear</button>
      </div>
     </div>
     <div className={'view '+(dragging?'dragging':'')} onDragOver={event=>{event.preventDefault();setDragging(true)}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget))setDragging(false)}} onDrop={onDrop}>
      <ModelViewer ref={viewerRef} key={file?.name||'empty'} file={file} onLoaded={setStats}/>
      {stats&&<div className="modelstats">{stats.meshes} meshes · {stats.vertices.toLocaleString()} vertices · {stats.triangles.toLocaleString()} triangles · {stats.materials||0} materials · {stats.textures||0} textures{stats.dimensions?' · '+stats.dimensions.x+' × '+stats.dimensions.y+' × '+stats.dimensions.z+' units':''}</div>}
      {dragging&&<div className="dropcover">Drop your 3D file to import</div>}
      {!file&&!stats&&<div className="empty"><div className="cube"><Box size={34}/></div><b>Your 3D canvas is ready</b><p>Import a model to inspect its structure in the interactive viewport.</p><label className="primary"><Upload size={16}/> Upload 3D file<input type="file" accept={formats.map(value=>'.'+value).join(',')} onChange={upload} hidden/></label><small>GLB · GLTF · FBX · OBJ · STL · PLY · 3MF · DAE · USDZ</small></div>}
     </div>
     <div className="viewfoot"><span><span className="dot"/> REAL-TIME VIEWPORT</span><span>Orbit · Pan · Zoom</span></div>
    </section>
    <aside className="assistant">
     <div className="chathead"><div className="aiicon"><Sparkles size={17}/></div><div><b>Nova Assistant</b><small>Conversational 3D copilot</small></div><button className="dots" onClick={newProject}>＋</button></div>
     <div className="modelpick"><span>MODE</span><button onClick={()=>setModel(model==='Nova Studio'?'Nova Reasoner':'Nova Studio')}>{model}<ChevronDown size={14}/></button></div>
     <div className="messages">{messages.map((message,index)=><div className={'message '+message.role} key={index}><div className="msgavatar">{message.role==='assistant'?<Sparkles size={14}/>:'Y'}</div><div className="bubble">{message.text}</div></div>)}{busy&&<div className="typing">Nova is thinking…</div>}</div>
     <div className="suggestions"><button onClick={()=>setPrompt('Help me understand the structure of my 3D model.')}>Analyze my model</button><button onClick={()=>setPrompt('Give me ideas to improve this 3D asset.')}>Improve this asset</button></div>
     <div className="composer"><textarea value={prompt} onChange={event=>setPrompt(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();send()}}} placeholder="Talk naturally with Nova…" /><div className="composefoot"><span><Sparkles size={13}/> Multi-turn chat</span><button disabled={!prompt.trim()||busy} onClick={send}><Send size={15}/></button></div></div>
     <div className="disclaimer">Recent conversation is saved on this device. Provider key stays on the server.</div>
    </aside>
   </div>
  </main>
 </div>;
}
