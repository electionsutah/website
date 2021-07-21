---
title: Weber County
permalink: "/places/weber/"
layout: page
comments: true
---

<div class="columns">
<ul>
  <li><a href="eden">Eden</a></li>
  <li><a href="farr-west">Farr West</a></li>
  <li><a href="harrisville">Harrisville</a></li>
  <li><a href="huntsville">Huntsville</a></li>
  <li><a href="hooper">Hooper</a></li>
  <li><a href="huntsville">Huntsville</a></li>
  <li><a href="liberty">Liberty</a></li>
  <li><a href="marriott-slaterville">Marriott-Slaterville</a></li>
  <li><a href="north-ogden">North Ogden</a></li>
  <li><a href="ogden">Ogden</a></li>
  <li><a href="washington-terrace">Washington Terrace</a></li>
  <li><a href="west-haven">West Haven</a></li>
</ul>
</div>

### 2017 Municipal Election

{% include 2018-elections.html %}

#### 2018 Primary Candidates

{% assign county = site.data.2018.primary.candidates | where:'county','Weber' | sort: 'last_name' %}
<table>
<thead>
  <th>First Names</th>
  <th>Last Names</th>
  <th>Candidate for</th>
  <th>City</th>
  <th>County</th>
</thead>
<tbody>
{% for member in county  %}
  <tr>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.first_names }}</a></td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.last_names }}</a></td>
    <td><a href="{{ site.url }}/office/{{ member.office | downcase | replace: ' ','-' | replace: '.','' | replace: '(','' | replace: ')','' }}">{{ member.office }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}">{{ member.city }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}">{{ member.county }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>
