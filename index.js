import * as THREE from 'https://unpkg.com/three@0.112/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.112/examples/jsm/controls/OrbitControls.js';
var container = document.getElementById('container');
var points = await fetch('points_cleaned.txt')
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return response.text();
  })
  .then(data => {
    const lines = data.split('\n');
    const points = lines.map(line => {
        const values = line.split(',').map(value => parseFloat(value));
        return new THREE.Vector3(values[0], values[1], values[2]);
    });
    return points;
  })
  .catch(error => {
    console.error('Error:', error);
  });

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
var renderer = new THREE.WebGLRenderer();
renderer.setSize(500, 500);
var controls = new OrbitControls(camera, renderer.domElement);
container.appendChild(renderer.domElement);
camera.position.z = 5;

var geometry = new THREE.BufferGeometry();
var positions = new Float32Array(points.length * 3);

for (var i = 0; i < points.length; i++) {
  positions[i * 3] = points[i].x;
  positions[i * 3 + 1] = points[i].y;
  positions[i * 3 + 2] = points[i].z;
}
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
var material = new THREE.PointsMaterial({ size: 1, color: 0x00ffff });
var particleSystem = new THREE.Points(geometry, material);
scene.add(particleSystem);
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
  positions.set(points.flatMap(p => [p.x, p.y, p.z]));
  geometry.attributes.position.needsUpdate = true;
}
animate();
// calculate the center of the grid
var center = new THREE.Vector3();
for (var i = 0; i < points.length; i++) {
  center.add(points[i]);
}
center.divideScalar(points.length);
var radius = 0;
for (var i = 0; i < points.length; i++) {
  radius = Math.max(radius, center.distanceTo(points[i]));
}
camera.position.copy(center);
camera.position.z += radius;
camera.near = radius / 100;
camera.far = radius * 100;
camera.updateProjectionMatrix();
async function drawLinesAtIndex(index) {
  const gridSize = 101; // Assuming the grid is 101x101
  const row = Math.floor(index / gridSize);
  const col = index % gridSize;
  const rowPoints = [];
  const colPoints = [];
  // Extract points for the row
  for (let i = 0; i < gridSize; i++) {
    rowPoints.push(points[row * gridSize + i]);
  }
  // Extract points for the column
  for (let i = 0; i < gridSize; i++) {
    colPoints.push(points[i * gridSize + col]);
  }
  const rowGeometry = new THREE.BufferGeometry().setFromPoints(rowPoints);
  const colGeometry = new THREE.BufferGeometry().setFromPoints(colPoints);
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const rowLine = new THREE.Line(rowGeometry, lineMaterial);
  const colLine = new THREE.Line(colGeometry, lineMaterial);
  scene.add(rowLine);
  scene.add(colLine);
}
var scaleFactor = 1;
const scaleMatrix = new THREE.Matrix4().makeScale(1, 1, scaleFactor);
function scaleFactorFromScrollY(scrollY) {
  return scrollY / document.body.scrollHeight;
}
window.addEventListener('scroll', () => {
  scaleFactor = scaleFactorFromScrollY(window.scrollY);
  console.log(window.scrollY, scaleFactor, document.body.scrollHeight)
  scaleFactor = scaleFactorFromScrollY(window.scrollY);
  const scaleMatrix = new THREE.Matrix4().makeScale(1, 1, scaleFactor);
  for (const point of points) {
    point.applyMatrix4(scaleMatrix);
  }
  positions.set(points.flatMap(p => [p.x, p.y, p.z]));
  geometry.attributes.position.needsUpdate = true;
});
for (const point of points) {
  point.applyMatrix4(scaleMatrix);
}
geometry.attributes.position.needsUpdate = true;
// scale the lines in z-axis
await drawLinesAtIndex(2352); 