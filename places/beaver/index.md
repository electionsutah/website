---
title: Beaver County
permalink: "/places/beaver/"
layout: page
comments: true
---

{% assign place = site.data.places.beaver_county %}

<section class="info">
  <p><a href="{{ place.wikipedia_url }}">From Wikipedia:</a></p>
  <p class="citation">{{ place.wikipedia_snippet }}</p>
</section>

<div class="columns">
<ul>
  <li><a href="beaver">Beaver</a></li>
  <li><a href="milford">Milford</a></li>
  <li><a href="minersville">Minersville</a></li>
</ul>
</div>

### 2018 Election

{% include 2018-elections.html %}

#### 2018 Primary Candidates
{% assign county = site.data.2018.primary.candidates | where:'county','Beaver' | sort: 'last_name' %}
<table>
<thead>
  <th>First Name</th>
  <th>Last Name</th>
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