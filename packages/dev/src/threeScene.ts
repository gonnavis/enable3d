import { Project, Scene3D, PhysicsLoader, ExtendedObject3D, THREE } from 'enable3d'
import { MaterialConfig } from '../../enable3d/node_modules/@enable3d/common/dist/types'
import { SpotLight, SpotLightHelper, PointLight, DirectionalLight } from '../../threeWrapper/dist'

var debugWheels = false
var material: MaterialConfig = { lambert: { transparent: true, opacity: 0.5 } }

class MainScene extends Scene3D {
  keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    space: false
  }
  car: any
  motors: {
    leftWheel: Ammo.btHingeConstraint
    rightWheel: Ammo.btHingeConstraint
    axis: Ammo.btHingeConstraint
  }
  light: DirectionalLight

  preload() {
    this.load.preload('grass', '/assets/grass.jpg')
  }

  addWheel(x: number, z: number) {
    const y = debugWheels ? 3 : 1
    const wheel = this.add.cylinder(
      { mass: 50, radiusBottom: 0.5, radiusTop: 0.5, radiusSegments: 24, height: 0.35, x, y, z },
      material
    )

    wheel.rotateZ(Math.PI / 2)
    // @ts-ignore
    // this.physics.add.existing(wheel, { shape: 'convex' })
    this.physics.add.existing(wheel)
    wheel.body.setFriction(2)
    return wheel
  }

  addBody() {
    const box = this.add.box(
      { y: 1, width: 1.5, depth: 3.65, mass: 1200, height: 0.25 },
      { lambert: { ...material.lambert, wireframe: true } }
    )
    this.physics.add.existing(box, { collisionFlags: 0 })
    return box
  }

  addAxis(z: number) {
    const y = debugWheels ? 3 : 1
    const box = this.add.box({ mass: 50, x: 0, y, z, height: 0.25, width: 1.75, depth: 0.25 }, material)
    this.physics.add.existing(box)
    return box
  }

  async create() {
    // this.warpSpeed()s

    this.physics.add.box({ y: 0.25, x: 1.25, z: -3, collisionFlags: 2 })
    this.physics.add.box({ y: 0.5, x: 1.25, z: -4, collisionFlags: 2 })

    const { lights } = await this.warpSpeed('-ground')
    const light = lights?.directionalLight
    if (light) {
      this.light = light

      const d = 5
      this.light.shadow.camera.top = d
      this.light.shadow.camera.bottom = -d
      this.light.shadow.camera.left = -d
      this.light.shadow.camera.right = d

      this.lights.helper.directionalLightHelper(light)

      const shadowHelper = new THREE.CameraHelper(light.shadow.camera)
      this.scene.add(shadowHelper)
    }

    this.load.texture('grass').then(grass => {
      grass.wrapS = grass.wrapT = 1000 // RepeatWrapping
      grass.offset.set(0, 0)
      grass.repeat.set(20, 20)

      let ground = this.physics.add.ground({ width: 200, height: 200, y: 0 }, { phong: { map: grass } })
      ground.body.setFriction(1)
    })

    this.physics.debug?.enable()
    this.physics.debug?.mode(2048 + 4096)

    this.camera.position.set(0, 5, -10)

    const wheels = {
      front: { left: this.addWheel(1.5, 1.5), right: this.addWheel(-1.5, 1.5) },
      back: { left: this.addWheel(1.5, -1.5), right: this.addWheel(-1.5, -1.5) }
    }

    const body = this.addBody()
    body.add(this.camera)

    const axis = { front: this.addAxis(1.5), back: this.addAxis(-1.5) }

    const car = { body, axis, wheels }
    this.car = car

    // constraints

    const stiffness = 250
    const damping = 0.01
    const limits = {
      linearLowerLimit: { x: 0, y: 0, z: 0 },
      linearUpperLimit: { x: 0, y: 0.25, z: 0 },
      angularLowerLimit: { x: 0, y: 0, z: -Math.PI },
      angularUpperLimit: { x: 0, y: 0, z: Math.PI }
    }
    this.physics.add.constraints.spring(body.body, axis.back.body, {
      angularLock: false,
      ...limits,
      stiffness,
      damping,
      offset: { x: 0.75, y: 0, z: 0 }
    })

    this.physics.add.constraints.spring(body.body, axis.back.body, {
      angularLock: false,
      ...limits,
      stiffness,
      damping,
      offset: { x: -0.75, y: 0, z: 0 }
    })

    const axisMotor = this.physics.add.constraints.hinge(body.body, axis.front.body, {
      pivotA: { z: 1.5, y: -0 },
      pivotB: {},
      axisA: { y: 1 },
      axisB: { y: 1 }
      // angularLowerLimit: {
      //   x: 0,
      //   y: -0.3,
      //   z: 0
      // },
      // angularUpperLimit: {
      //   x: 0,
      //   y: 0.3,
      //   z: 0
      // }
    })

    const wheelLeft = { pivotA: { x: 1.25 }, pivotB: { x: 0 }, axisA: { x: 1 }, axisB: { y: -1 } }
    const wheelRight = { pivotA: { x: -1.25 }, pivotB: { x: 0 }, axisA: { x: 1 }, axisB: { y: -1 } }

    this.physics.add.constraints.hinge(axis.front.body, wheels.front.left.body, {
      ...wheelLeft
    })
    this.physics.add.constraints.hinge(axis.front.body, wheels.front.right.body, {
      ...wheelRight
    })

    const leftWheelMotor = this.physics.add.constraints.hinge(axis.back.body, wheels.back.left.body, {
      ...wheelLeft
    })

    const rightWheelMotor = this.physics.add.constraints.hinge(axis.back.body, wheels.back.right.body, {
      ...wheelRight
    })

    axisMotor.setLimit(-0.4, 0.4, 1, 1)
    axisMotor.enableAngularMotor(true, 0, 100000.0)

    // leftWheelMotor.setLimit(-Math.PI, Math.PI, 5, 5)
    // rightWheelMotor.setLimit(-Math.PI, Math.PI, 5, 5)

    this.motors = { axis: axisMotor, leftWheel: leftWheelMotor, rightWheel: rightWheelMotor }

    const press = (e: KeyboardEvent, isDown: boolean) => {
      e.preventDefault()
      const { code } = e
      switch (code) {
        case 'KeyW':
          this.keys.w = isDown
          break
        case 'KeyA':
          this.keys.a = isDown
          break
        case 'KeyS':
          this.keys.s = isDown
          break
        case 'KeyD':
          this.keys.d = isDown
          break
        case 'Space':
          this.keys.space = isDown
          break
      }
    }

    document.addEventListener('keydown', e => press(e, true))
    document.addEventListener('keyup', e => press(e, false))
  }

  update() {
    this.light.position.x = this.car.body.position.x
    this.light.position.y = this.car.body.position.y + 200
    this.light.position.z = this.car.body.position.z + 100
    this.light.target = this.car.body

    this.camera.lookAt(this.car.body.position)
    // this.light.position.copy(this.car.body)
    // this.light.position.add(new THREE.Vector3(-5, 9, 3))

    const move = (direction: number) => {
      console.log('move')
      const speed = 50
      // this.car.wheels.back.left.body.applyLocalTorque(0, direction * force, 0)
      // this.car.wheels.back.right.body.applyLocalTorque(0, direction * force, 0)
      // this.motors.leftWheel.setMotorTarget(direction, dt)
      // this.motors.leftWheel.setMotorTarget(0, dt)
      // this.motors.leftWheel.setMotorTarget(2, dt)
      // this.motors.rightWheel.setMotorTarget(direction, wwwwdt)
      this.motors.leftWheel.enableAngularMotor(true, speed * direction, 0.2)
      this.motors.rightWheel.enableAngularMotor(true, speed * direction, 0.2)
    }

    const turn = (direction: number) => {
      const dt = 0.5

      this.motors.axis.setMotorTarget(direction, dt)
      //   this.car.axis.front.body.applyLocalTorque(0, direction * force, 0)
      //   this.car.axis.front.body.applyLocalTorque(0, direction * force, 0)
    }

    if (this.keys.w) move(1)
    else if (this.keys.s) move(-1)
    else {
      this.motors.leftWheel.enableAngularMotor(true, 0, 0.02)
      this.motors.rightWheel.enableAngularMotor(true, 0, 0.02)
      // this.motors.leftWheel.enableMotor(false)
      // this.motors.rightWheel.enableMotor(false)
    }

    if (this.keys.a) turn(1)
    else if (this.keys.d) turn(-1)
    else this.motors.axis.setMotorTarget(0, 1)

    if (this.keys.space) this.car.body.body.applyForceY(2)
  }
}

const startProject = () => {
  PhysicsLoader('/lib', () => new Project({ scenes: [MainScene] }))
}

export default startProject
