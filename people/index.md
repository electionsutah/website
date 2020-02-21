---
layout: page
title: People
permalink: /people/
comments: true
---

### 2020 Elections

{% include 2020-elections.html %}

#### 2020 U.S. Presidential Candidates
{% assign person = site.data.people | where:'election_2020.office','U.S. President' | sort: 'last_name' %}
<table>
<thead>
  <th></th>
  <th>First Name</th>
  <th>Last Name</th>
  <th>Candidate for</th>
  <th>Party</th>
</thead>
<tbody>
{% for member in person  %}
  <tr>
    <td>
      {% if member.image %}
      <a href="{{ site.url }}/people/{{ member.id }}">
        <img class="table-image" src="{{ member.image }}" alt="{{ member.full_name }}">
      </a>
      {% endif %}
    </td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.first_names }}</a></td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.last_names }}</a></td>
    <td><a href="{{ site.url }}/office/{{ member.office | downcase | replace: ' ','-' | replace: '.','' | replace: '(','' | replace: ')','' }}">{{ member.election_2020.office }}</a></td>
    <td><a href="{{ site.url }}/party/{{ member.election_2020.party | downcase | replace: ' ','-' | replace: '.','' }}">{{ member.election_2020.party }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>

<br>

### 2019 Municipal Elections

{% include 2019-municipal-elections.html %}

{% assign person = site.data.2019.candidates | sort: 'last_name' %}
<table>
<thead>
  <th></th>
  <th>First Name</th>
  <th>Last Name</th>
  <th>Candidate for</th>
  <th>City</th>
  <th>County</th>
</thead>
<tbody>
{% for member in person  %}
  <tr>
    <td>
      {% if member.image %}
      <a href="{{ site.url }}/people/{{ member.id }}">
        <img class="table-image" src="{{ member.image }}" alt="{{ member.full_name }}">
      </a>
      {% endif %}
    </td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.first_name }}</a></td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.last_name }}</a></td>
    <td><a href="{{ site.url }}/office/{{ member.office | downcase | replace: ' ','-' | replace: '.','' | replace: '(','' | replace: ')','' }}">{{ member.office }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}">{{ member.city }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}">{{ member.county }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>

<br>

### 2018 Election

{% include 2018-elections.html %}

#### Primary Candidates
{% assign person = site.data.people | where: 'election_2018', true | sort: 'last_name' %}
<table>
<thead>
  <th></th>
  <th>First Name</th>
  <th>Last Name</th>
  <th>Candidate for</th>
  <th>City</th>
  <th>County</th>
</thead>
<tbody>
{% for member in person  %}
  <tr>
    <td>
      {% if member.image %}
      <a href="{{ site.url }}/people/{{ member.id }}">
        <img class="table-image" src="{{ member.image }}" alt="{{ member.full_name }}">
      </a>
      {% endif %}
    </td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.first_name }}</a></td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.last_name }}</a></td>
    <td><a href="{{ site.url }}/office/{{ member.election_2018.office | downcase | replace: ' ','-' | replace: '.','' | replace: '(','' | replace: ')','' }}">{{ member.election_2018.office }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.election_2018.city | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}">{{ member.election_2018.city }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.election_2018.county | downcase | replace: ' ','-' }}">{{ member.election_2018.county }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>

<br>
### 2017 Municipal Election
#### Primary Candidates
{% assign person = site.data.2017.primary.candidates %}
<table>
<thead>
  <th></th>
  <th>Name</th>
  <th>Candidate for</th>
  <th>City</th>
  <th>County</th>
</thead>
<tbody>
{% for member in person  %}
  <tr>
    <td>
      {% if member.image %}
      <a href="{{ site.url }}/people/{{ member.id }}">
        <img class="table-image" src="{{ member.image }}" alt="{{ member.full_name }}">
      </a>
      {% endif %}
    </td>
    <td><a href="{{member.id}}">{{member.name}}</a></td>
    <td>{{ member.body }}</td>
    <td><a href="../places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}">{{ member.city }}</a></td>
    <td><a href="../places/{{ member.county | downcase | replace: ' ','-' }}">{{ member.county }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>
