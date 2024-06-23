import * as THREE from 'https://unpkg.com/three@0.112/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.112/examples/jsm/controls/OrbitControls.js';

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
var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
var renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
var controls = new OrbitControls(camera, renderer.domElement);
document.body.appendChild(renderer.domElement);
camera.position.z = 5;

var geometry = new THREE.BufferGeometry();
var positions = new Float32Array( points.length * 3 );

for ( var i = 0; i < points.length; i ++ ) {

	positions[ i * 3 ] = points[ i ].x;
	positions[ i * 3 + 1 ] = points[ i ].y;
	positions[ i * 3 + 2 ] = points[ i ].z;

}

geometry.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );

var material = new THREE.PointsMaterial( { size: 0.5 } );
var particleSystem = new THREE.Points( geometry, material );
scene.add( particleSystem );

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();


// calculate the center of the grid
var center = new THREE.Vector3();
for (var i = 0; i < points.length; i++) {
  center.add(points[i]);
}
center.divideScalar(points.length);

// calculate the radius of the grid
var radius = 0;
for (var i = 0; i < points.length; i++) {
  radius = Math.max(radius, center.distanceTo(points[i]));
}

// adjust the camera to see the entire grid
camera.position.copy(center);
camera.position.z += radius;
camera.near = radius / 100;
camera.far = radius * 100;
camera.updateProjectionMatrix();



// make the grid blue and the background white
particleSystem.material.color.setHex( 0x00ffff ); // blue


particleSystem.material.size = 201.;  
particleSystem.material.sizeAttenuation = true;
particleSystem.material.needsUpdate = true;
 // bigger dots

// enable antialiasing
renderer.antialias = true;

// enable depth buffering
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.render( scene, camera );