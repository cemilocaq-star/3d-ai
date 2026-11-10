import React,{forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {PLYLoader} from 'three/addons/loaders/PLYLoader.js';
import {ColladaLoader} from 'three/addons/loaders/ColladaLoader.js';
import {USDZLoader} from 'three/addons/loaders/USDZLoader.js';
import {ThreeMFLoader} from 'three/addons/loaders/3MFLoader.js';

function disposeObject(root){
 root?.traverse?.(node=>{
  if(node.geometry)node.geometry.dispose();
  const materials=Array.isArray(node.material)?node.material:[node.material];
  materials.filter(Boolean).forEach(material=>{
   Object.values(material).forEach(value=>{if(value?.isTexture)value.dispose()});
   material.dispose();
  });
 });
}
function rounded(value){return Number.isFinite(value)?Math.round(value*1000)/1000:null}
function getDimensions(object){
 const bounds=new THREE.Box3().setFromObject(object);
 if(bounds.isEmpty())return null;
 const size=bounds.getSize(new THREE.Vector3());
 return{x:rounded(size.x),y:rounded(size.y),z:rounded(size.z)};
}
function findObjectByName(root,name){
 let match=null;
 root.traverse(node=>{if(!match&&node.name===name)match=node});
 return match;
}
function applySceneActions(root,actions){
 if(!root)return (Array.isArray(actions)?actions:[]).map(action=>({type:action.type,ok:false,reason:'No model is loaded'}));
 const results=[];
 for(const action of Array.isArray(actions)?actions:[]){
  let target=null;
  if(action.type!=='add_primitive')target=findObjectByName(root,action.objectName);
  if(action.type==='add_primitive'){
   const geometries={
    box:()=>new THREE.BoxGeometry(1,1,1),
    sphere:()=>new THREE.SphereGeometry(.5,32,24),
    cylinder:()=>new THREE.CylinderGeometry(.5,.5,1,32),
    torus:()=>new THREE.TorusGeometry(.4,.14,16,48)
   };
   const geometry=geometries[action.primitive]?.();
   if(!geometry){results.push({type:action.type,ok:false,reason:'Unsupported primitive'});continue}
   const object=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:action.color}));
   object.name=action.name;
   object.position.set(action.position.x,action.position.y,action.position.z);
   object.scale.set(action.scale.x,action.scale.y,action.scale.z);
   root.add(object);
   results.push({type:action.type,ok:true,name:object.name});
   continue;
  }
  if(!target){results.push({type:action.type,ok:false,reason:'Object not found: '+action.objectName});continue}
  if(action.type==='rename_object'){
   target.name=action.name;
   results.push({type:action.type,ok:true,name:target.name});
  }else if(action.type==='set_material_color'){
   const list=Array.isArray(target.material)?target.material:[target.material];
   const editable=list.filter(material=>material?.color?.set);
   if(!editable.length){results.push({type:action.type,ok:false,reason:'Object has no editable color material'});continue}
   editable.forEach(material=>{material.color.set(action.color);material.needsUpdate=true});
   results.push({type:action.type,ok:true,name:target.name});
  }else if(action.type==='set_transform'){
   if(action.position)target.position.set(action.position.x,action.position.y,action.position.z);
   if(action.rotation)target.rotation.set(
    THREE.MathUtils.degToRad(action.rotation.x),
    THREE.MathUtils.degToRad(action.rotation.y),
    THREE.MathUtils.degToRad(action.rotation.z)
   );
   if(action.scale)target.scale.set(action.scale.x,action.scale.y,action.scale.z);
   results.push({type:action.type,ok:true,name:target.name});
  }else if(action.type==='delete_object'){
   if(target===root||!target.parent){results.push({type:action.type,ok:false,reason:'The scene root cannot be deleted'});continue}
   target.parent.remove(target);
   disposeObject(target);
   results.push({type:action.type,ok:true,name:target.name});
  }else{
   results.push({type:action.type,ok:false,reason:'Unsupported scene action'});
  }
 }
 root.updateMatrixWorld(true);
 return results;
}
function measure(root){
 root.updateMatrixWorld(true);
 let meshes=0,vertices=0,triangles=0,uvMeshes=0,normalMeshes=0,vertexColorMeshes=0,skinnedMeshes=0,morphMeshes=0;
 const materials=new Set(),textures=new Set(),meshDetails=[];
 root.traverse(node=>{
  if(!node.isMesh)return;
  meshes++;
  if(!node.name)node.name='Mesh '+meshes;
  const geometry=node.geometry;
  const attributes=geometry?.attributes||{};
  const vertexCount=attributes.position?.count||0;
  const triangleCount=Math.floor((geometry?.index?.count||vertexCount)/3);
  const hasUV=Boolean(attributes.uv);
  const hasNormals=Boolean(attributes.normal);
  const hasVertexColors=Boolean(attributes.color);
  const hasSkinning=Boolean(node.isSkinnedMesh);
  const morphTargets=Object.values(geometry?.morphAttributes||{}).some(list=>Array.isArray(list)&&list.length>0);
  vertices+=vertexCount;
  triangles+=triangleCount;
  if(hasUV)uvMeshes++;
  if(hasNormals)normalMeshes++;
  if(hasVertexColors)vertexColorMeshes++;
  if(hasSkinning)skinnedMeshes++;
  if(morphTargets)morphMeshes++;
  const meshMaterials=Array.isArray(node.material)?node.material:[node.material];
  const materialNames=[],materialColors=[];
  for(const material of meshMaterials.filter(Boolean)){
   materials.add(material);
   if(material.name)materialNames.push(material.name.slice(0,80));
   if(material.color?.isColor)materialColors.push('#'+material.color.getHexString());
   for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
  }
  if(meshDetails.length<20){
   meshDetails.push({
    name:(node.name||'Mesh '+meshes).slice(0,80),
    geometryType:geometry?.type||'BufferGeometry',
    vertices:vertexCount,triangles:triangleCount,
    dimensions:getDimensions(node),
    hasUV,hasNormals,hasVertexColors,hasSkinning,morphTargets,
    materials:[...new Set(materialNames)].slice(0,4),
    materialColors:[...new Set(materialColors)].slice(0,4)
   });
  }
 });
 return{
  meshes,vertices,triangles,materials:materials.size,textures:textures.size,
  uvMeshes,normalMeshes,vertexColorMeshes,skinnedMeshes,morphMeshes,
  dimensions:getDimensions(root),meshDetails
 };
}

const ModelViewer=forwardRef(function ModelViewer({file,onLoaded=()=>{}},ref){
 const host=useRef(null),state=useRef({}),[error,setError]=useState('');
 useEffect(()=>{
  const element=host.current;
  if(!element)return;
  const scene=new THREE.Scene();
  scene.background=new THREE.Color('#0b101a');
  const camera=new THREE.PerspectiveCamera(45,1,.01,10000);
  camera.position.set(4,3,5);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  element.appendChild(renderer.domElement);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;
  scene.add(new THREE.HemisphereLight(0xffffff,0x354052,2));
  const light=new THREE.DirectionalLight(0xffffff,2.5);
  light.position.set(4,7,5);
  scene.add(light);
  let frame;
  const grid=new THREE.GridHelper(12,24,0x344158,0x202b3b);
  scene.add(grid);
  const resize=()=>{
   const width=element.clientWidth||1,height=element.clientHeight||1;
   camera.aspect=width/height;
   camera.updateProjectionMatrix();
   renderer.setSize(width,height);
  };
  const observer=new ResizeObserver(resize);
  observer.observe(element);
  resize();
  const animate=()=>{
   frame=requestAnimationFrame(animate);
   controls.update();
   renderer.render(scene,camera);
  };
  animate();
  state.current={
   grid,current:null,scene,
   clear:()=>{
    const loaded=state.current.current;
    if(loaded){scene.remove(loaded);disposeObject(loaded)}
    state.current.current=null;
    onLoaded(null);
   },
   load:object=>{
    const previous=state.current.current;
    if(previous){scene.remove(previous);disposeObject(previous)}
    state.current.current=object;
    scene.add(object);
    const bounds=new THREE.Box3().setFromObject(object);
    if(!bounds.isEmpty()){
     const size=bounds.getSize(new THREE.Vector3());
     const center=bounds.getCenter(new THREE.Vector3());
     const max=Math.max(size.x,size.y,size.z)||1;
     object.position.sub(center);
     camera.position.set(max*1.8,max*1.35,max*1.8);
     camera.near=Math.max(max/1000,.001);
     camera.far=max*100;
     camera.updateProjectionMatrix();
     controls.target.set(0,0,0);
     controls.update();
    }
    onLoaded(measure(object));
   }
  };
  return()=>{
   cancelAnimationFrame(frame);
   observer.disconnect();
   controls.dispose();
   const loaded=state.current.current;
   if(loaded){scene.remove(loaded);disposeObject(loaded)}
   renderer.dispose();
   element.removeChild(renderer.domElement);
   state.current={};
  };
 },[onLoaded]);

 useImperativeHandle(ref,()=>({
  toggleGrid(){
   if(!state.current.grid)return false;
   state.current.grid.visible=!state.current.grid.visible;
   return state.current.grid.visible;
  },
  applyActions(actions){
   let root=state.current.current;
   if(!root&&Array.isArray(actions)&&actions.some(action=>action.type==='add_primitive')){
    root=new THREE.Group();
    root.name='Nova Generated Scene';
    state.current.current=root;
    state.current.scene.add(root);
   }
   const results=applySceneActions(root,actions);
   if(root)onLoaded(measure(root));
   return results;
  },
  clearScene(){
   state.current.clear?.();
  },
  async exportGLB(){
   const root=state.current.current;
   if(!root)throw new Error('Create or import a scene before exporting.');
   const exporter=new GLTFExporter();
   const result=await new Promise((resolve,reject)=>exporter.parse(root,resolve,reject,{binary:true}));
   const blob=new Blob([result],{type:'model/gltf-binary'});
   const url=URL.createObjectURL(blob);
   const anchor=document.createElement('a');
   anchor.href=url;
   anchor.download='nova-export.glb';
   anchor.click();
   URL.revokeObjectURL(url);
   return true;
  }
 }),[onLoaded]);

 useEffect(()=>{
  if(!file||!state.current.load)return;
  const url=URL.createObjectURL(file);
  let cancelled=false;
  setError('');
  const extension=file.name.split('.').pop().toLowerCase();
  const done=object=>{if(cancelled)disposeObject(object);else state.current.load(object)};
  const fail=()=>{if(!cancelled)setError('Could not load this file. Check that the asset is valid and self-contained.')};
  try{
   if(extension==='glb'||extension==='gltf')new GLTFLoader().load(url,gltf=>done(gltf.scene),undefined,fail);
   else if(extension==='fbx')new FBXLoader().load(url,done,undefined,fail);
   else if(extension==='obj')new OBJLoader().load(url,done,undefined,fail);
   else if(extension==='stl'||extension==='ply'){
    const loader=extension==='stl'?new STLLoader():new PLYLoader();
    loader.load(url,geometry=>{
     if(extension==='ply'&&geometry.hasAttribute('color')){
      done(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true})));
     }else{
      if(!geometry.getAttribute('normal'))geometry.computeVertexNormals();
      done(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x9aaec8,metalness:.25,roughness:.55})));
     }
    },undefined,fail);
   }else if(extension==='dae')new ColladaLoader().load(url,collada=>done(collada.scene),undefined,fail);
   else if(extension==='usdz')new USDZLoader().load(url,done,undefined,fail);
   else if(extension==='3mf')new ThreeMFLoader().load(url,done,undefined,fail);
   else fail();
  }catch{fail()}
  return()=>{cancelled=true;URL.revokeObjectURL(url)};
 },[file]);

 return <div ref={host} style={{position:'absolute',inset:0}}>{error&&<div className="loaderror">{error}</div>}</div>;
});
export default ModelViewer;
