# Network Policy Test
Using this repo as a sandbox for any K8 testing - not the be used for workshops<br/>
<br/>
Allowing any pod to talk to Kube DNS to prevent scenarios where you break traffic
```
apiVersion: projectcalico.org/v3
kind: GlobalNetworkPolicy
metadata:
  name: security.allow-kube-dns
spec:
  tier: security
  order: 155
  selector: ''
  namespaceSelector: ''
  serviceAccountSelector: ''
  egress:
    - action: Allow
      source: {}
      destination:
        selector: k8s-app == "kube-dns"
    - action: Pass
      source: {}
      destination: {}
  doNotTrack: false
  applyOnForward: false
  preDNAT: false
  types:
    - Egress
```

I recommend running this in the 'security' tier of Calico Enterprise, if you are taking a shift-left approach:
```
kubectl apply -f allow-kube-dns.yaml
```

## Set policy to allow external traffic for cluster IPs


Add rules to allow the external traffic for each clusterIP. <br/>
The following example allows connections to two cluster IPs. <br/>
Make sure you add applyOnForward and preDNAT rules.

```
apiVersion: projectcalico.org/v3
kind: GlobalNetworkPolicy
metadata:
  name: allow-cluster-ips
spec:
  selector: k8s-role == 'node'
  types:
  - Ingress
  applyOnForward: true
  preDNAT: true
  ingress:
  # Allow 50.60.0.0/16 to access Cluster IP A
  - action: Allow
    source:
      nets:
      - 50.60.0.0/16
    destination:
      nets:
      - 10.20.30.40/32 # Cluster IP A
  # Allow 70.80.90.0/24 to access Cluster IP B
  - action: Allow
    source:
      nets:
      - 70.80.90.0/24
    destination:
      nets:
      - 10.20.30.41/32 # Cluster IP B
```

## Add a rule to allow traffic destined for the pod CIDR
Without this rule, normal pod-to-pod traffic is blocked because the policy applies to forwarded traffic.

```
apiVersion: projectcalico.org/v3
kind: GlobalNetworkPolicy
metadata:
  name: allow-to-pods
spec:
  selector: k8s-role == 'node'
  types:
  - Ingress
  applyOnForward: true
  preDNAT: true
  ingress:
  # Allow traffic forwarded to pods
  - action: Allow
    destination:
      nets:
      - 192.168.0.0/16 # Pod CIDR
```


## Calico OS test application

Deploy a demo application

```
kubectl apply -f https://raw.githubusercontent.com/GoogleCloudPlatform/microservices-demo/master/release/kubernetes-manifests.yaml
```

Deploy boutiqueshop policies

```
kubectl apply -f https://raw.githubusercontent.com/tigera-solutions/tigera-eks-workshop/main/demo/boutiqueshop/policies.yaml
```

## RBAC SA's for CaliEnt

Nigel:

```
kubectl get secret $(kubectl get serviceaccount nigel -o jsonpath='{range .secrets[*]}{.name}{"\n"}{end}' | grep token) -o go-template='{{.data.token | base64decode}}' && echo
```

Taher:

```
kubectl get secret $(kubectl get serviceaccount taher -o jsonpath='{range .secrets[*]}{.name}{"\n"}{end}' | grep token) -o go-template='{{.data.token | base64decode}}' && echo
```

## Global Alert Test (work in progress)

```
kubectl apply -f - <<EOF
apiVersion: projectcalico.org/v3
kind: GlobalAlert
metadata:
 name: frequent-dns-responses
spec:
 description: "Monitor for NXDomain"
 summary: "Observed ${sum} NXDomain responses for ${qname}"
 severity: 100
 dataSet: dns
 query: rcode = NXDomain 
 aggregateBy: 
 - qname
 field: count
 metric: sum
 condition: gte
 threshold: 1
EOF
```

## Host Endpoint Test Not Working

In which circumstance we will see the “deny” flow for HEP? <br/>
I tried two use cases so far: <br/>
<br/>
With EKS, I open the port in EKS security group for 0.0.0.0 cidr, and apply policy to deny all then allow one cidr from external server. <br/>
I was able to see the allow flow with external public IP but not able to see other deny flow logs. <br/>
<br/>
With AKS,  I peered my vm vnet and AKS vnet, and was able to deny the traffic from vm to one of AKS node by apply a deny policy with private ip of vm. <br/>
However, I’m not able to see the flow logs in service graph (including allow & deny flow from my VM). <br/>

#### EKS:
```
spec:
  tier: security
  order: 100
  selector: host-end-point == "test"
  # Allow all traffic to localhost.
  ingress:
  - action: Allow
    destination:
      nets:
      - 127.0.0.1/32
  # Allow node port access only from specific CIDR.
  - action: Deny
    protocol: TCP
    source:
      notNets:
      - ${PUB_IP}
    destination:
      ports:
      - 30080
  doNotTrack: false
  applyOnForward: true
  preDNAT: true
  types:
    - Ingress
```

#### AKS:
```
spec:
  tier: security
  order: 100
  selector: host-end-point == "test"
  # Allow all traffic to localhost.
  ingress:
  - action: Allow
    destination:
      nets:
      - 127.0.0.1/32
  # Deny node port access from specific CIDR.
  - action: Deny
    protocol: TCP
    source:
      nets:
      - {PRV_IP}
    destination:
      ports:
      - 30080
  doNotTrack: false
  applyOnForward: true
  preDNAT: true
  types:
    - Ingress
```
