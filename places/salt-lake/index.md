---
title: Salt Lake County
permalink: "/places/salt-lake/"
layout: page
comments: true
---

<nav class="content-nav">
  <a href="#2019-municipal-elections">2019</a>
  <a href="#2018-elections">2018</a>
  <a href="#2017-municipal-elections">2017</a>
</nav>
<div class="columns">
<ul>
  <li><a href="alta">Alta</a></li>
  <li><a href="bluffdale">Bluffdale</a></li>
  <li><a href="cottonwood-heights">Cottonwood Heights</a></li>
  <li><a href="draper">Draper</a></li>
  <li><a href="herriman">Herriman</a></li>
  <li><a href="holladay">Holladay</a></li>
  <li><a href="kearns">Kearns</a></li>
  <li><a href="magna">Magna</a></li>
  <li><a href="midvale">Midvale</a></li>
  <li><a href="millcreek">Millcreek</a></li>
  <li><a href="murray">Murray</a></li>
  <li><a href="riverton">Riverton</a></li>
  <li><a href="salt-lake-city">Salt Lake City</a></li>
  <li><a href="sandy">Sandy</a></li>
  <li><a href="south-jordan">South Jordan</a></li>
  <li><a href="south-salt-lake">South Salt Lake</a></li>
  <li><a href="taylorsville">Taylorsville</a></li>
  <li><a href="west-jordan">West Jordan</a></li>
  <li><a href="west-valley-city">West Valley City</a></li>
</ul>
</div>

### 2019 Municipal Elections

{% include 2019-municipal-elections.html %}

{% assign county = site.data.2019.candidates | where:'county','Salt Lake' | sort:'last_name' %}
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
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.first_name }}</a></td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.last_name }}</a></td>
    <td><a href="{{ site.url }}/office/{{ member.office | downcase | replace: ' ','-' | replace: '.','' | replace: '(','' | replace: ')','' }}">{{ member.office }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}">{{ member.city }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}">{{ member.county }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>

### 2018 Elections

{% include 2018-elections.html %}

#### 2018 Primary Candidates
{% assign county = site.data.2018.primary.candidates | where:'county','Salt Lake' | sort:'last_name' %}
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
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.first_name }}</a></td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.last_name }}</a></td>
    <td><a href="{{ site.url }}/office/{{ member.office | downcase | replace: ' ','-' | replace: '.','' | replace: '(','' | replace: ')','' }}">{{ member.office }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}">{{ member.city }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}">{{ member.county }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>

### 2017 Municipal Elections

{% include 2017-municipal-elections.html %}

{% assign county = site.data.2017.primary.candidates | where:'county','Salt Lake' | sort:'last_name' %}
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
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.first_name }}</a></td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.last_name }}</a></td>
    <td><a href="{{ site.url }}/office/{{ member.office | downcase | replace: ' ','-' | replace: '.','' | replace: '(','' | replace: ')','' }}">{{ member.office }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}">{{ member.city }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}">{{ member.county }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>
