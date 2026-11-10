import React,{Suspense,lazy,useCallback,useEffect,useRef,useState} from 'react';
import {Box,Plus,Upload,MessageSquare,Settings,Send,Sparkles,PanelLeft,Download,RotateCcw,Layers,ChevronDown,FileBox,LockKeyhole,LogOut} from 'lucide-react';
const ModelViewer=lazy(()=>import('./ModelViewer.jsx'));

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
 const [selectedMeshIds,setSelectedMeshIds]=useState([]);
 const [materialColor,setMaterialColor]=useState('#9ab6d4');
 const [materialRoughness,setMaterialRoughness]=useState(0.55);
 const [materialMetalness,setMaterialMetalness]=useState(0.15);
 const [materialMessage,setMaterialMessage]=useState('');
 const selectedMeshId=selectedMeshIds[selectedMeshIds.length-1]||null;
 const [gridOn,setGridOn]=useState(true);
 const [multiSelectEnabled,setMultiSelectEnabled]=useState(false);
 const [apiStatus,setApiStatus]=useState('checking');
 const [auth,setAuth]=useState({checking:true,required:false,authenticated:false});
 const [authPassword,setAuthPassword]=useState('');
 const [authError,setAuthError]=useState('');
 const [authBusy,setAuthBusy]=useState(false);
 const [loadProgress,setLoadProgress]=useState(null);
 const [mobileTab,setMobileTab]=useState('studio');

 useEffect(()=>{
  let active=true;
  fetch('/api/v1/health')
   .then(response=>{if(!response.ok)throw new Error('API unavailable');return response.json()})
   .then(data=>{if(active)setApiStatus(data.configured?'ready':'unconfigured')})
   .catch(()=>{if(active)setApiStatus('offline')});
  fetch('/api/v1/auth/status',{cache:'no-store'})
   .then(response=>{if(!response.ok)throw new Error('Authentication status unavailable');return response.json()})
   .then(data=>{if(active)setAuth({checking:false,required:Boolean(data.required),authenticated:Boolean(data.authenticated)})})
   .catch(()=>{if(active)setAuth({checking:false,required:false,authenticated:false})});
  return()=>{active=false};
 },[]);

 useEffect(()=>{
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(messages.slice(-80)))}
  catch{/* Browser storage can be unavailable or full. */}
 },[messages]);

 const handleLoaded=useCallback(nextStats=>{
  setStats(nextStats);
  setLoadProgress(null);
  setSelectedMeshIds(current=>current.filter(id=>nextStats?.hierarchy?.some(node=>node.id===id&&node.kind==='Mesh')));
 },[]);
 const handleLoadProgress=useCallback(progress=>{
  setLoadProgress(progress?.status==='loading'?progress:null);
 },[]);
 const updateSelection=(ids,event)=>{
  const unique=[...new Set(ids)].slice(0,20);
  const selection=new Set(multiSelectEnabled||event?.ctrlKey||event?.metaKey||event?.shiftKey?selectedMeshIds:[]);
  unique.forEach(id=>selection.has(id)?selection.delete(id):selection.add(id));
  const selected=[...selection].slice(0,20);
  viewerRef.current?.selectMeshes(selected);
  setSelectedMeshIds(selected);
 };
 useEffect(()=>{
  const selected=(stats?.meshDetails||[]).filter(mesh=>selectedMeshIds.includes(mesh.id));
  const colors=selected.flatMap(mesh=>mesh.materialColors||[]);
  if(colors.length)setMaterialColor(colors[0]);
 },[selectedMeshIds,stats]);
 const applyMaterial=()=>{
  const result=viewerRef.current?.applyMaterialProperties({color:materialColor,roughness:materialRoughness,metalness:materialMetalness});
  setMaterialMessage(result?.ok?'Applied to '+result.changed+' selected mesh(es).':result?.reason||'Select a mesh first.');
 };
 const applyTexture=async event=>{
  const image=event.target.files?.[0];
  event.target.value='';
  if(!image)return;
  if(!['image/png','image/jpeg','image/webp'].includes(image.type)){setMaterialMessage('Choose a PNG, JPEG or WebP image.');return}
  const result=await viewerRef.current?.applyTexture(image);
  setMaterialMessage(result?.ok?'Texture applied to '+result.changed+' mesh(es).':result?.reason||'Texture could not be applied.');
 };
 const selectMesh=(id,event)=>updateSelection([id],event);
 const selectHierarchyNode=(node,event)=>{
  const ids=node.kind==='Mesh'?[node.id]:(viewerRef.current?.getDescendantMeshIds(node.id)||[]);
  if(ids.length)updateSelection(ids,event);
 };
 const acceptFile=selectedFile=>{
  if(!selectedFile)return;
  const extension=selectedFile.name.split('.').pop().toLowerCase();
  if(!formats.includes(extension)){
   setLoadProgress(null);
   setMessages(current=>[...current,{role:'assistant',text:'Unsupported extension: .'+extension+'. Supported formats: '+formats.join(', ')}].slice(-80));
   return;
  }
  const mobileDevice=window.matchMedia('(max-width: 680px)').matches;
  const maxModelBytes=(mobileDevice?75:150)*1024*1024;
  if(selectedFile.size>maxModelBytes){
   setLoadProgress(null);
   setMessages(current=>[...current,{role:'assistant',text:'This model is larger than '+(mobileDevice?'75':'150')+' MB. For a smoother experience, reduce the model size, resize large textures or export an optimized GLB.'}].slice(-80));
   return;
  }
  viewerRef.current?.clearScene();
  setFile(selectedFile);
  setStats(null);
  setSelectedMeshIds([]);
  setMaterialMessage('');
  setLoadProgress({status:'loading',loaded:0,total:selectedFile.size,percent:0,phase:'Preparing model'});
  setMessages(current=>[...current,{role:'assistant',text:'Imported '+selectedFile.name+'. I can use its structural statistics in our conversation after the model finishes loading.'}].slice(-80));
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
 const toggleMultiSelect=()=>{
  if(multiSelectEnabled&&selectedMeshIds.length>1){
   const keep=selectedMeshIds[selectedMeshIds.length-1];
   viewerRef.current?.selectMeshes([keep]);
   setSelectedMeshIds(keep?[keep]:[]);
  }
  setMultiSelectEnabled(value=>!value);
 };
 const clearAsset=()=>{
  viewerRef.current?.clearScene();
  setFile(null);
  setStats(null);
  setSelectedMeshIds([]);
  setMultiSelectEnabled(false);
  setMaterialMessage('');
  setLoadProgress(null);
 };
 const newProject=()=>{
  clearAsset();
  setPrompt('');
  setMessages([welcomeMessage]);
 };
 const login=async event=>{
  event.preventDefault();
  if(authBusy)return;
  setAuthBusy(true);
  setAuthError('');
  try{
   const response=await fetch('/api/v1/auth/login',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({password:authPassword})
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||'Login failed. Check the app password.');
   setAuth({checking:false,required:true,authenticated:true});
   setAuthPassword('');
  }catch(error){
   setAuthError(error.message||'Could not sign in. Check the server connection.');
  }finally{
   setAuthBusy(false);
  }
 };
 const logout=async()=>{
  if(authBusy)return;
  setAuthBusy(true);
  setAuthError('');
  try{
   const response=await fetch('/api/v1/auth/logout',{method:'POST'});
   if(!response.ok)throw new Error('Could not sign out. Please refresh the page.');
   setAuth(current=>({...current,authenticated:false}));
  }catch(error){
   setAuthError(error.message||'Could not sign out.');
  }finally{
   setAuthBusy(false);
  }
 };
 const generateModel=()=>{
  const description=prompt.trim();
  if(!description||busy)return;
  const result=viewerRef.current?.createModelFromPrompt(description);
  if(!result?.ok){
   setMessages(current=>[...current,{role:'assistant',text:result?.reason||'The 3D model could not be created.'}].slice(-80));
   return;
  }
  setFile(null);
  setSelectedMeshIds([]);
  setMobileTab('studio');
  setPrompt('');
  setMessages(current=>[...current,{role:'assistant',text:'Created **'+result.name+'** directly on this device. It contains '+result.stats.meshes+' editable meshes and can be customized, inspected and exported as GLB. This offline builder currently supports robots, houses, trees, cars, chairs and desk lamps; other prompts create a desk lamp starter model.'}].slice(-80));
 };
 const send=async()=>{
  const text=prompt.trim();
  if(!text||busy)return;
  setPrompt('');
  const conversation=[...messages,{role:'user',text}].slice(-80);
  setMessages(conversation);
  setBusy(true);
  try{
   const extension=file?.name.split('.').pop().toLowerCase();
   const asset=stats?{filename:file?.name||'nova-scene',format:extension||'scene',stats}:null;
   const response=await fetch('/api/v1/chat',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
     messages:conversation.slice(-16).map(item=>({role:item.role,content:item.text})),
     mode:model,
     asset,
     selectedMeshId,
     selectedMeshIds
    })
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||'Nova API request failed (HTTP '+response.status+').');
   const actions=Array.isArray(data.actions)?data.actions:[];
   if(actions.length){
    const outcomes=viewerRef.current?.applyActions(actions)||actions.map(action=>({type:action.type,ok:false,reason:'No active 3D scene'}));
    const applied=outcomes.filter(result=>result.ok).length;
    const failed=outcomes.length-applied;
    const summary=[
     applied?'Applied '+applied+' of '+actions.length+' requested scene change(s) in the viewport.':'No requested scene changes could be applied. Check the selected object and target names.',
     failed?failed+' change(s) could not be applied.':'',
     typeof data.reply==='string'?data.reply.trim():''
    ].filter(Boolean).join('\n\n');
    setMessages(current=>[...current,{role:'assistant',text:summary}].slice(-80));
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

 if(auth.checking||(auth.required&&!auth.authenticated)){
  return <main className="auth-screen">
   <form className="auth-card" onSubmit={login}>
    <div className="brandmark"><LockKeyhole size={22}/></div>
    <span className="auth-eyebrow">NOVA 3D AI STUDIO</span>
    <h1>Private workspace</h1>
    <p>This Nova instance is password-protected. Enter the app password to continue.</p>
    <label htmlFor="nova-app-password">App password</label>
    <input id="nova-app-password" type="password" autoComplete="current-password" maxLength={256} value={authPassword} onChange={event=>setAuthPassword(event.target.value)} placeholder="Enter app password" required disabled={authBusy}/>
    {authError&&<div className="auth-error" role="alert">{authError}</div>}
    <button className="auth-submit" type="submit" disabled={authBusy||!authPassword.trim()}>{authBusy?'Signing in…':'Sign in'}</button>
    <small>Your password is sent only to this server. The session cookie is HttpOnly.</small>
   </form>
  </main>;
 }
 return <div className={"shell mobile-"+mobileTab}>
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
    <div className="headerRight"><span className="status"><span className={'api-indicator '+apiStatus}/> {apiStatus==='ready'?'Nova API ready':apiStatus==='unconfigured'?'Provider key required':apiStatus==='offline'?'Nova API offline':'Checking Nova API…'}</span><button className="share" onClick={()=>viewerRef.current?.exportGLB().catch(error=>setMessages(current=>[...current,{role:'assistant',text:error.message}]))}><Download size={14}/> Export GLB</button></div>
   </header>
   <div className="workspace">
    <section className="viewportPanel">
     <div className="paneltop">
      <div><b>3D VIEWPORT</b><small>{file?file.name:stats?'AI-generated scene':'No asset loaded'}</small></div>
      <div className="tools">
       <label className="toolbtn"><Upload size={15}/> Import<input id="nova-file-input" type="file" accept={formats.map(value=>'.'+value).join(',')} onChange={upload} hidden/></label>
       <button className="toolbtn" onClick={()=>setGridOn(viewerRef.current?.toggleGrid()??gridOn)}><Layers size={15}/> Grid {gridOn?'On':'Off'}</button>
       <button className={'toolbtn '+(multiSelectEnabled?'active':'')} aria-pressed={multiSelectEnabled} onClick={toggleMultiSelect}><Layers size={15}/> Multi</button>
       <button className="toolbtn" onClick={clearAsset}><RotateCcw size={15}/> Clear</button>
      </div>
     </div>
     <div className={'view '+(dragging?'dragging':'')} onDragOver={event=>{event.preventDefault();setDragging(true)}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget))setDragging(false)}} onDrop={onDrop}>
      <Suspense fallback={<div className="viewport-loading" role="status">Loading 3D engine…</div>}><ModelViewer ref={viewerRef} key={file?.name||'empty'} file={file} onLoaded={handleLoaded} onLoadProgress={handleLoadProgress}/></Suspense>
      {loadProgress&&<div className="import-progress" role="status" aria-live="polite"><div><b>{loadProgress.phase||'Loading model'}</b><span>{loadProgress.percent===null?'Working…':Math.round(loadProgress.percent)+'%'}</span></div><div className="progress-track"><span className={loadProgress.percent===null?'indeterminate':''} style={{width:loadProgress.percent===null?'35%':loadProgress.percent+'%'}}/></div></div>}
      {stats&&<><div className="modelstats">{stats.meshes} meshes · {stats.vertices.toLocaleString()} vertices · {stats.triangles.toLocaleString()} triangles · {stats.materials||0} materials · {stats.textures||0} textures{stats.dimensions?' · '+stats.dimensions.x+' × '+stats.dimensions.y+' × '+stats.dimensions.z+' units':''}</div>{stats.meshDetails?.length>0&&<details className="mesh-inspector"><summary>Mesh inspection · {stats.meshDetails.length}{stats.meshes>stats.meshDetails.length?' of '+stats.meshes:''}</summary><div className="mesh-list">{stats.meshDetails.map((mesh,index)=><div className={'mesh-row '+(selectedMeshIds.includes(mesh.id)?'selected':'')} key={mesh.id||index} role="button" tabIndex={0} aria-pressed={selectedMeshIds.includes(mesh.id)} onClick={event=>selectMesh(mesh.id,event)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectMesh(mesh.id,event)}}}><div className="mesh-row-head"><b>{mesh.name}</b><button className="visibility-toggle" onClick={event=>{event.stopPropagation();const visible=viewerRef.current?.toggleMeshVisibility(mesh.id);if(visible!==null&&visible!==undefined)setStats(current=>current?{...current,meshDetails:current.meshDetails.map(item=>item.id===mesh.id?{...item,visible}:item)}:current)}}>{mesh.visible?'Hide':'Show'}</button></div><span>{mesh.geometryType} · {mesh.vertices.toLocaleString()} vertices · {mesh.triangles.toLocaleString()} triangles</span><span>{mesh.dimensions?[mesh.dimensions.x,mesh.dimensions.y,mesh.dimensions.z].join(' × ')+' units':''}</span><span>{[mesh.hasUV?'UV':'',mesh.hasNormals?'Normals':'',mesh.hasVertexColors?'Vertex colors':'',mesh.hasSkinning?'Skinned':'',mesh.morphTargets?'Morph targets':''].filter(Boolean).join(' · ')||'No UV/normal/skin/morph flags detected'}</span>{mesh.materials?.length>0&&<span>Materials: {mesh.materials.join(', ')}</span>}{mesh.materialColors?.length>0&&<span className="swatches">{mesh.materialColors.map(color=><i key={color} title={color} style={{backgroundColor:color}}/>)} <small>{mesh.materialColors.join(' ')}</small></span>}</div>)}</div><details className="hierarchy-tree"><summary>Scene hierarchy · {stats.hierarchy?.length||0}{stats.hierarchy?.length>=200?' (first 200)':''} · {selectedMeshIds.length} selected</summary><div className="hierarchy-list">{(stats.hierarchy||[]).map(node=><div key={node.id} className={'hierarchy-node '+(node.kind==='Mesh'?'mesh-node':'group-node')+(selectedMeshIds.includes(node.id)?' selected':'')} style={{paddingLeft:8+node.depth*12}}>{node.kind==='Mesh'?<button className="hierarchy-select" onClick={event=>selectHierarchyNode(node,event)} aria-pressed={selectedMeshIds.includes(node.id)}><span className="hierarchy-kind">◈</span><span>{node.name}</span></button>:<button className="hierarchy-group" onClick={event=>selectHierarchyNode(node,event)}><span className="hierarchy-kind">▸</span>{node.name} <small>{node.kind}</small></button>}<button className="visibility-toggle hierarchy-eye" onClick={event=>{event.stopPropagation();viewerRef.current?.toggleHierarchyVisibility(node.id)}}>{node.visible?'Hide':'Show'}</button><span className="hierarchy-visibility">{node.visible?'Visible':'Hidden'}</span></div>)}</div></details><details className="material-editor"><summary>Material editor · {selectedMeshIds.length} selected</summary><div className="material-controls"><label>Base color<input aria-label="Material base color" type="color" value={materialColor} onChange={event=>setMaterialColor(event.target.value)}/></label><label>Roughness <b>{materialRoughness.toFixed(2)}</b><input aria-label="Material roughness" type="range" min="0" max="1" step="0.01" value={materialRoughness} onChange={event=>setMaterialRoughness(Number(event.target.value))}/></label><label>Metallic <b>{materialMetalness.toFixed(2)}</b><input aria-label="Material metallic" type="range" min="0" max="1" step="0.01" value={materialMetalness} onChange={event=>setMaterialMetalness(Number(event.target.value))}/></label><button className="toolbtn material-apply" disabled={!selectedMeshIds.length} onClick={applyMaterial}>Apply to selection</button><label className="toolbtn texture-upload">Import texture<input type="file" accept="image/png,image/jpeg,image/webp" onChange={applyTexture} hidden/></label>{materialMessage&&<small role="status">{materialMessage}</small>}</div></details></details>}</>}
      {dragging&&<div className="dropcover">Drop your 3D file to import</div>}
      {!file&&!stats&&<div className="empty"><div className="cube"><Box size={34}/></div><b>Your 3D canvas is ready</b><p>Import a model to inspect its structure in the interactive viewport.</p><label className="primary"><Upload size={16}/> Upload 3D file<input type="file" accept={formats.map(value=>'.'+value).join(',')} onChange={upload} hidden/></label><small>Best on mobile: GLB · GLTF · FBX · OBJ · STL · PLY · 3MF · DAE · USDZ</small></div>}
     </div>
     <div className="viewfoot"><span><span className="dot"/> REAL-TIME VIEWPORT</span><span>Orbit · Pan · Zoom</span></div>
    </section>
    <aside className="assistant">
     <div className="chathead"><div className="aiicon"><Sparkles size={17}/></div><div><b>Nova Assistant</b><small>3D copilot · {apiStatus==='ready'?'API ready':apiStatus==='unconfigured'?'provider key needed':apiStatus==='offline'?'API offline':'checking API'}</small></div>{auth.required&&<button className="dots" onClick={logout} disabled={authBusy} title="Sign out" aria-label="Sign out"><LogOut size={17}/></button>}<button className="dots" onClick={newProject} title="New project" aria-label="New project">＋</button></div>
     <div className="modelpick"><span>MODE</span><button onClick={()=>setModel(model==='Nova Studio'?'Nova Reasoner':'Nova Studio')}>{model}<ChevronDown size={14}/></button></div>
     <div className="messages">{messages.map((message,index)=><div className={'message '+message.role} key={index}><div className="msgavatar">{message.role==='assistant'?<Sparkles size={14}/>:'Y'}</div><div className="bubble">{message.text}</div></div>)}{busy&&<div className="typing">Nova is thinking…</div>}</div>
     <div className="suggestions"><button onClick={()=>setPrompt('Help me understand the structure of my 3D model.')}>Analyze my model</button><button onClick={()=>setPrompt('Give me ideas to improve this 3D asset.')}>Improve this asset</button></div>
     <div className="composer"><textarea value={prompt} onChange={event=>setPrompt(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();send()}}} placeholder="Describe a robot, house, car, tree, chair or lamp…" /><div className="composefoot"><span><Sparkles size={13}/> Offline 3D builder</span><div className="compose-actions"><button className="generate-model" disabled={!prompt.trim()||busy} onClick={generateModel}>Create 3D</button><button disabled={!prompt.trim()||busy} onClick={send} title="Send chat message"><Send size={15}/></button></div></div></div>
     {authError&&<div className="auth-inline-error" role="alert">{authError}</div>}
     <div className="disclaimer">Recent conversation is saved on this device. Provider key stays on the server.{auth.required?' This is a private password-protected workspace.':''}</div>
    </aside>
   </div>
  </main>
  <nav className="mobile-nav" aria-label="Mobile workspace">
   <button className={mobileTab==='studio'?'active':''} aria-current={mobileTab==='studio'?'page':undefined} onClick={()=>setMobileTab('studio')}><Box size={18}/><span>Studio</span></button>
   <button className={mobileTab==='chat'?'active':''} aria-current={mobileTab==='chat'?'page':undefined} onClick={()=>setMobileTab('chat')}><MessageSquare size={18}/><span>Nova</span></button>
  </nav>
 </div>;
}
