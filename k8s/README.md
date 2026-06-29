Kubernetes Cluster
│
├── Control Plane
│   ├── API Server
│   ├── Scheduler
│   ├── Controller Manager
│   └── ETCD
│
├── Node-1 (Worker)
│   ├── kubelet
│   ├── kube-proxy
│   ├── Container Runtime (containerd)
│   └── Pods
│       ├── Pod-A
│       ├── Pod-B
│       └── Pod-C
│
├── Node-2 (Worker)
│   ├── kubelet
│   ├── kube-proxy
│   ├── Container Runtime
│   └── Pods
│
└── Namespaces
    │
    ├── default
    ├── dev
    ├── qa
    ├── staging
    └── production


production Namespace
│
├── Deployment
│   │
│   ├── ReplicaSet
│   │   │
│   │   ├── Pod-1
│   │   ├── Pod-2
│   │   └── Pod-3
│   │
│   └── Rollout History
│
├── Service
│   │
│   └── Load Balances Traffic
│           │
│           ├── Pod-1
│           ├── Pod-2
│           └── Pod-3
│
├── Ingress
│   │
│   └── Routes Internet Traffic
│
├── ConfigMap
│
├── Secret
│
├── HorizontalPodAutoscaler
│
├── NetworkPolicy
│
├── ServiceAccount
│
├── Role
│
├── RoleBinding
│
├── Job
│
├── CronJob
│
├── PVC
│
└── Events


Storage tree:

Application
│
└── Pod
     │
     └── Volume
          │
          └── PersistentVolumeClaim (PVC)
                    │
                    └── PersistentVolume (PV)
                              │
                              └── StorageClass
                                         │
                                         ├── AWS EBS
                                         ├── Azure Disk
                                         ├── GCP Persistent Disk
                                         └── Local Disk

Network tree:
Internet
    │
    ▼
Load Balancer (Optional)
    │
    ▼
Ingress Controller
    │
    ▼
Ingress
    │
    ▼
Service
    │
    ▼
Pods

Scalling

Deployment
    │
    ▼
ReplicaSet
    │
    ├── Pod-1
    ├── Pod-2
    ├── Pod-3
    └── Pod-4
          ▲
          │
Horizontal Pod Autoscaler

Security tree:

User / Application
        │
        ▼
ServiceAccount
        │
        ▼
Role
        │
        ▼
Role Binding

Cluster-wide permissions:

Cluster Admin
      │
      ▼
ClusterRole
      │
      ▼
ClusterRoleBinding


Complete Real-Time E-commerce Project:

Kubernetes Cluster
│
├── Namespace : ecommerce
│
├── Ingress
│      │
│      ▼
│   Service (Frontend)
│      │
│      ▼
│   Deployment
│      │
│      ▼
│   ReplicaSet
│      │
│      ├── React Pod-1
│      ├── React Pod-2
│      └── React Pod-3
│
├── Service (Backend)
│      │
│      ▼
│   Deployment
│      │
│      ▼
│   ReplicaSet
│      │
│      ├── API Pod-1
│      ├── API Pod-2
│      └── API Pod-3
│
├── Service (Redis)
│      │
│      ▼
│   StatefulSet
│      │
│      └── Redis Pod
│
├── Service (MySQL)
│      │
│      ▼
│   StatefulSet
│      │
│      ▼
│   PVC
│      │
│      ▼
│   PV
│      │
│      ▼
│   StorageClass
│
├── ConfigMap
├── Secret
├── HPA
├── NetworkPolicy
├── ServiceAccount
├── Role
├── RoleBinding
├── CronJob (Daily Backup)
└── Job (Database Migration)


💡 Easy Way to Remember (Interview Trick):

                    Kubernetes Cluster
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
    Infrastructure                      Application
        │                                     │
        │                              Namespace
        │                                     │
        │                          Deployment
        │                                │
        │                           ReplicaSet
        │                                │
        │                               Pods
        │                                │
        │          ┌───────────────┬─────┴───────┬─────────────┐
        │          │               │             │             │
        │      Service        ConfigMap      Secret         PVC
        │          │                                         │
        │      Ingress                                      PV
        │                                                    │
        │                                              StorageClass
        │
        └── Security
              ├── ServiceAccount
              ├── Role
              ├── RoleBinding
              ├── ClusterRole
              └── ClusterRoleBinding